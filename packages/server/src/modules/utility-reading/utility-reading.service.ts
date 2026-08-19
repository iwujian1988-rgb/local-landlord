import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UtilityReading } from './utility-reading.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { resolveFeeRules } from '../fee/fee-rules';
import { SaveUtilityReadingItemDto, SaveUtilityReadingsDto } from './dto/save-utility-readings.dto';
import { isUtilityFeeName, toCentsAmount, toFourDecimal, utilityName, utilityTypesForFeeRules } from './utility-reading.helpers';

@Injectable()
export class UtilityReadingService {
  constructor(
    @InjectRepository(UtilityReading)
    private readonly utilityRepository: Repository<UtilityReading>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) throw new ForbiddenException('无权访问该房间');
  }

  async getMonthly(roomId: number, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) {
      throw new BadRequestException('月份格式不正确');
    }
    const tenant = await this.tenantRepository.findOne({ where: { roomId, status: 1 } });
    if (!tenant) throw new BadRequestException('该房间暂无在租租客，不能录入水电');
    const utilityTypes = await this.getAllowedUtilityTypes(roomId, tenant);
    if (utilityTypes.length === 0) throw new BadRequestException('当前租约未设置水费或电费');
    const readings = await this.utilityRepository.find({ where: { roomId, tenantId: tenant.id, period } });
    const records = await Promise.all(utilityTypes.map(async utilityType => {
      const existing = readings.find(record => record.utilityType === utilityType);
      const latest = await this.utilityRepository.createQueryBuilder('reading')
        .where('reading.room_id = :roomId', { roomId })
        .andWhere('reading.tenant_id = :tenantId', { tenantId: tenant.id })
        .andWhere('reading.utility_type = :utilityType', { utilityType })
        .andWhere('reading.period < :period', { period })
        .andWhere('reading.current_reading IS NOT NULL')
        .orderBy('reading.period', 'DESC')
        .getOne();
      return {
        utilityType,
        name: utilityName(utilityType),
        previousReadingSuggested: existing?.previousReading ?? latest?.currentReading ?? null,
        isFirstReading: !latest,
        reading: existing ? this.toResponse(existing) : null,
      };
    }));
    const bill = await this.entityManager.findOne(Bill, { where: { roomId, tenantId: tenant.id, period } });
    return {
      roomId,
      roomName: (await this.roomRepository.findOne({ where: { id: roomId } }))?.name || '',
      tenantId: tenant.id,
      tenantName: tenant.name,
      period,
      utilityTypes,
      bill: bill ? { id: bill.id, status: bill.status, sentAt: bill.sentAt } : null,
      records,
    };
  }

  async saveMonthly(roomId: number, dto: SaveUtilityReadingsDto) {
    if (!dto.readings?.length) throw new BadRequestException('请至少填写一项水电记录');
    if (new Set(dto.readings.map(reading => reading.utilityType)).size !== dto.readings.length) {
      throw new BadRequestException('水费和电费各只能填写一次');
    }
    return this.entityManager.transaction(async manager => {
      const tenant = await manager.findOne(Tenant, { where: { roomId, status: 1 } });
      if (!tenant) throw new BadRequestException('该房间暂无在租租客，不能录入水电');
      const room = await manager.findOne(Room, { where: { id: roomId } });
      if (!room) throw new NotFoundException('房间不存在');
      const legacyFeeItems = await manager.find(FeeItem, { where: { roomId }, order: { sortOrder: 'ASC' } });
      const allowedTypes = utilityTypesForFeeRules(resolveFeeRules(tenant.feeRules, legacyFeeItems, Number(room.rent) || 0));
      if (allowedTypes.length === 0) throw new BadRequestException('当前租约未设置水费或电费');
      if (dto.readings.some(reading => !allowedTypes.includes(reading.utilityType))) {
        throw new BadRequestException('提交的水电项目不属于当前租约');
      }
      const bill = await manager.findOne(Bill, { where: { roomId, tenantId: tenant.id, period: dto.period } });
      if (bill && [1, 3, 4].includes(bill.status)) {
        throw new BadRequestException('该月账单已收款或已作废，不能再修改水电记录');
      }

      const saved: UtilityReading[] = [];
      for (const item of dto.readings) {
        const normalized = await this.normalizeReading(manager, roomId, tenant.id, dto.period, item);
        let record = await manager.findOne(UtilityReading, {
          where: { roomId, tenantId: tenant.id, period: dto.period, utilityType: item.utilityType },
        });
        if (!record) {
          record = manager.create(UtilityReading, { roomId, tenantId: tenant.id, period: dto.period, utilityType: item.utilityType });
        }
        Object.assign(record, normalized, { billId: bill?.id ?? null });
        saved.push(await manager.save(record));
      }

      if (bill) {
        const allMonthlyReadings = await manager.find(UtilityReading, {
          where: { roomId, tenantId: tenant.id, period: dto.period },
        });
        await this.syncBillUtilities(manager, bill, allMonthlyReadings);
      }
      return Promise.all(saved.map(record => this.toResponse(record)));
    });
  }

  private async getAllowedUtilityTypes(roomId: number, tenant: Tenant): Promise<number[]> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const legacyFeeItems = await this.feeItemRepository.find({ where: { roomId }, order: { sortOrder: 'ASC' } });
    return utilityTypesForFeeRules(resolveFeeRules(tenant.feeRules, legacyFeeItems, Number(room.rent) || 0));
  }

  private async normalizeReading(
    manager: EntityManager,
    roomId: number,
    tenantId: number,
    period: string,
    item: SaveUtilityReadingItemDto,
  ) {
    const base = {
      photos: item.photos || [],
      note: item.note?.trim() || null,
    };
    if (item.mode === 'none') {
      return { ...base, chargeMode: 0, previousReading: null, currentReading: null, usage: null, unitPrice: null, amount: 0 };
    }
    if (item.mode === 'manual') {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException(`${utilityName(item.utilityType)}金额不正确`);
      return { ...base, chargeMode: 1, previousReading: null, currentReading: null, usage: null, unitPrice: null, amount: toCentsAmount(amount) };
    }

    let previous = item.previousReading;
    if (previous === undefined || previous === null) {
      const latest = await manager.createQueryBuilder(UtilityReading, 'reading')
        .where('reading.room_id = :roomId', { roomId })
        .andWhere('reading.tenant_id = :tenantId', { tenantId })
        .andWhere('reading.utility_type = :utilityType', { utilityType: item.utilityType })
        .andWhere('reading.period < :period', { period })
        .andWhere('reading.current_reading IS NOT NULL')
        .orderBy('reading.period', 'DESC')
        .getOne();
      previous = latest?.currentReading ?? undefined;
    }
    const current = Number(item.currentReading);
    const price = Number(item.unitPrice);
    if (previous === undefined || previous === null) throw new BadRequestException(`首次录入${utilityName(item.utilityType)}，请填写上次表读数`);
    if (!Number.isFinite(current) || current < Number(previous)) throw new BadRequestException(`${utilityName(item.utilityType)}本次读数不能小于上次读数`);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException(`${utilityName(item.utilityType)}单价不正确`);
    const usage = toCentsAmount(current - Number(previous));
    return {
      ...base,
      chargeMode: 2,
      previousReading: toCentsAmount(Number(previous)),
      currentReading: toCentsAmount(current),
      usage,
      unitPrice: toFourDecimal(price),
      amount: toCentsAmount(usage * price),
    };
  }

  private async syncBillUtilities(manager: EntityManager, bill: Bill, saved: UtilityReading[]) {
    const items = await manager.find(BillItem, { where: { billId: bill.id } });
    const retained = items.filter(item => !isUtilityFeeName(item.feeName));
    await manager.delete(BillItem, { billId: bill.id });
    const utilityItems = saved
      .filter(record => record.chargeMode !== 0)
      .map(record => manager.create(BillItem, {
        billId: bill.id,
        feeName: utilityName(record.utilityType),
        amount: record.amount,
        utilityReadingId: record.id,
      }));
    const nextItems = [...retained.map(item => manager.create(BillItem, {
      billId: bill.id,
      feeName: item.feeName,
      amount: item.amount,
      utilityReadingId: item.utilityReadingId ?? null,
    })), ...utilityItems];
    await manager.save(nextItems);
    bill.totalAmount = toCentsAmount(nextItems.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    await manager.save(bill);
  }

  private toResponse(record: UtilityReading) {
    return {
      id: record.id,
      utilityType: record.utilityType,
      name: utilityName(record.utilityType),
      mode: record.chargeMode === 2 ? 'metered' : record.chargeMode === 1 ? 'manual' : 'none',
      previousReading: record.previousReading == null ? null : Number(record.previousReading),
      currentReading: record.currentReading == null ? null : Number(record.currentReading),
      usage: record.usage == null ? null : Number(record.usage),
      unitPrice: record.unitPrice == null ? null : Number(record.unitPrice),
      amount: Number(record.amount || 0),
      photos: record.photos || [],
      note: record.note || '',
      billId: record.billId,
    };
  }
}
