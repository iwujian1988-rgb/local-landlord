import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import dayjs from 'dayjs';
import { Room } from './room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { feeRulesToResponse, resolveFeeRules, feeRuleDueMonths, feeRuleAmountForMonths } from '../fee/fee-rules';
import { TenantService } from '../tenant/tenant.service';
import { dueDateForPeriod } from '../bill/bill-due-date';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UtilityReading } from '../utility-reading/utility-reading.entity';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
    private readonly tenantService: TenantService,
  ) {}

  private async collectionState(room: Room, tenant?: Tenant | null) {
    if (room.status === 2) return { displayStatus: 'archived', overdueDays: 0 };
    if (room.status !== 1 || !tenant) return { displayStatus: 'vacant', overdueDays: 0 };
    const today = dayjs().startOf('day');
    const bills = await this.billRepository.find({ where: { tenantId: tenant.id } });
    let overdueDays = 0;
    let approaching = false;
    for (const bill of bills) {
      if (bill.status === 1 || bill.status === 4 || Number(bill.paidAmount) >= Number(bill.totalAmount)) continue;
      const due = bill.dueDate ? dayjs(bill.dueDate).startOf('day') : dueDateForPeriod(bill.period, tenant.rentDay);
      const days = due.diff(today, 'day');
      overdueDays = Math.max(overdueDays, -days);
      if (days >= 1 && days <= 3) approaching = true;
    }
    const period = today.format('YYYY-MM');
    if (!bills.some(bill => bill.period === period)) {
      const legacy = await this.feeItemRepository.find({ where: { roomId: room.id } });
      const rules = resolveFeeRules(tenant.feeRules, legacy, Number(room.rent));
      const expected = rules.reduce((sum, rule) => sum + feeRuleAmountForMonths(rule,
        feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, period)), 0);
      const days = dueDateForPeriod(period, tenant.rentDay).diff(today, 'day');
      if (expected > 0 && days >= 1 && days <= 3) approaching = true;
    }
    return { displayStatus: overdueDays > 0 ? 'overdue' : approaching ? 'approaching' : 'rented', overdueDays };
  }

  /** Verify that a property belongs to the given landlord */
  async verifyPropertyOwnership(propertyId: number, landlordId: number): Promise<void> {
    const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('房源不存在');
    if (property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房源下的房间');
    }
  }

  /** Verify that a room belongs to a property owned by the given landlord */
  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['property'],
    });
    if (!room) throw new NotFoundException('房间不存在');
    if (!room.property || room.property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房间');
    }
  }

  /** Get all rooms for a landlord across all properties */
  async findAllForLandlord(landlordId: number, includeArchived = false): Promise<any[]> {
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) return [];

    const propertyIds = properties.map(p => p.id);
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const rooms = await this.roomRepository.find({
      where: { propertyId: In(propertyIds), ...(!includeArchived ? { status: In([0, 1]) } : {}) },
      order: { createdAt: 'DESC' },
    });
    if (rooms.length === 0) return [];

    const roomIds = rooms.map(r => r.id);

    const tenants = await this.tenantRepository.find({
      where: { roomId: In(roomIds), status: 1 },
    });
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) tenantMap.set(t.roomId, t);

    const feeItems = await this.feeItemRepository.find({
      where: { roomId: In(roomIds) },
      order: { sortOrder: 'ASC' },
    });
    const feeMap = new Map<number, FeeItem[]>();
    for (const f of feeItems) {
      const list = feeMap.get(f.roomId) || [];
      list.push(f);
      feeMap.set(f.roomId, list);
    }

    const result: any[] = [];
    for (const room of rooms) {
      const tenant = tenantMap.get(room.id);
      const prop = propertyMap.get(room.propertyId);
      const fees = feeRulesToResponse(resolveFeeRules(
        tenant?.feeRules,
        feeMap.get(room.id) || [],
        Number(room.rent) || 0,
      ));

      const rentDay = tenant?.rentDay ?? 10;

      const { displayStatus, overdueDays } = await this.collectionState(room, tenant);

      result.push({
        id: room.id,
        name: room.name,
        rent: Number(room.rent) || 0,
        status: room.status,
        images: room.images || [],
        propertyId: room.propertyId,
        propertyName: prop?.name || '',
        tenantName: tenant?.name || '',
        tenantId: tenant?.id || null,
        rentDay,
        displayStatus,
        overdueDays,
        feeItems: fees,
      });
    }

    return result;
  }

  /** Get rooms under a property (API contract shape with propertyName, totalAmount, string displayStatus) */
  async findByProperty(
    propertyId: number,
    status?: number,
  ): Promise<any> {
    const property = await this.propertyRepository.findOne({ where: { id: propertyId } });

    const where: any = { propertyId, status: In([0, 1]) };
    if (status !== undefined) {
      where.status = status;
    }

    const rooms = await this.roomRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const roomIds = rooms.map(r => r.id);

    const tenants = roomIds.length > 0
      ? await this.tenantRepository.find({ where: { roomId: In(roomIds), status: 1 } })
      : [];
    const tenantMap = new Map<number, Tenant>();
    for (const t of tenants) tenantMap.set(t.roomId, t);

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Find bills covering current month — multi-month aware (押X付Y bills span
    // period..periodEnd). Exclude cancelled (status=4) so退租 rooms don't show
    // as overdue.
    const currentBills: Bill[] = [];
    if (roomIds.length > 0) {
      for (const rid of roomIds) {
        const tenant = tenantMap.get(rid);
        const billQuery = this.billRepository
          .createQueryBuilder('bill')
          .where('bill.room_id = :rid', { rid })
          .andWhere('bill.status != :cancelled', { cancelled: 4 })
          .andWhere(
            '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
            'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
            { monthStr },
          );
        if (tenant) {
          billQuery.andWhere('bill.tenant_id = :tenantId', { tenantId: tenant.id });
        }
        const bill = await billQuery
          .orderBy('bill.created_at', 'DESC')
          .getOne();
        if (bill) currentBills.push(bill);
      }
    }
    const billMap = new Map<number, Bill>();
    for (const b of currentBills) billMap.set(b.roomId, b);

    const enrichedRooms: any[] = [];
    let vacant = 0, rented = 0, overdue = 0;

    for (const room of rooms) {
      const tenant = tenantMap.get(room.id);
      const bill = billMap.get(room.id);
      const rentDay = tenant?.rentDay ?? 10;
      const { displayStatus, overdueDays } = await this.collectionState(room, tenant);

      if (displayStatus === 'vacant') vacant++;
      else if (displayStatus === 'overdue') overdue++;
      else rented++;

      enrichedRooms.push({
        id: room.id,
        name: room.name,
        rent: Number(room.rent) || 0,
        status: room.status,
        images: room.images || [],
        displayStatus,
        tenantName: tenant?.name || '',
        rentDay,
        overdueDays,
        contractEndDate: tenant?.contractEndDate || '',
        totalAmount: bill ? Number(bill.totalAmount) || 0 : 0,
      });
    }

    return {
      list: enrichedRooms,
      summary: { total: rooms.length, vacant, rented, overdue },
      propertyName: property?.name || '',
    };
  }

  /** Get room detail (aggregated property + tenant + feeItems + latestBill) */
  async findOne(id: number): Promise<any> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!room) throw new NotFoundException('房间不存在');

    const tenants = await this.tenantRepository.find({
      where: { roomId: id },
      order: { createdAt: 'DESC' },
    });
    const activeTenant = tenants.find(t => t.status === 1) || null;

    const legacyFeeItems = await this.feeItemRepository.find({
      where: { roomId: id },
      order: { sortOrder: 'ASC' },
    });
    const feeItems = resolveFeeRules(activeTenant?.feeRules, legacyFeeItems, Number(room.rent) || 0);

    const latestBill = await this.billRepository.findOne({
      where: { roomId: id },
      order: { createdAt: 'DESC' },
    });

    // Partial-payment warning: if tenant has any status=3 (partial) bills,
    // surface the total paid amount so the landlord sees "this tenant already
    // paid ¥X, checkout will void the unpaid balance" before confirming.
    let activePartialPayment: { count: number; totalPaid: number } | null = null;
    let outstandingDebt = 0;
    if (activeTenant) {
      const openBills = await this.billRepository.find({ where: { tenantId: activeTenant.id, status: In([0, 2, 3]) } });
      outstandingDebt = openBills.reduce((sum, bill) => sum + Math.max(0,
        Number(bill.totalAmount) - Number(bill.paidAmount)), 0);
      const partialBills = await this.billRepository.find({
        where: { tenantId: activeTenant.id, status: 3 },
      });
      if (partialBills.length > 0) {
        activePartialPayment = {
          count: partialBills.length,
          totalPaid: partialBills.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0),
        };
      }
    }

    // P0-B: preview prepaid rent refund if tenant moves out today. Used by
    // DepositModal to show breakdown before user confirms checkout.
    let prepaidRefundPreview = 0;
    let latestPaidPeriodEnd: string | null = null;
    if (activeTenant) {
      const latestPaidBill = await this.billRepository.findOne({
        where: { tenantId: activeTenant.id, status: 1 },
        order: { periodEnd: 'DESC' },
      });
      if (latestPaidBill) {
        latestPaidPeriodEnd = latestPaidBill.periodEnd || latestPaidBill.period;
      }
      prepaidRefundPreview = await this.tenantService.computePrepaidRefund({
        ...activeTenant, moveOutDate: dayjs().format('YYYY-MM-DD'),
      });
    }

    const { displayStatus } = await this.collectionState(room, activeTenant);

    return {
      id: room.id,
      name: room.name,
      rent: Number(room.rent) || 0,
      status: room.status,
      deposit: room.deposit || 0,
      area: room.area || '',
      floor: room.floor || '',
      orientation: room.orientation || '',
      facilities: room.facilities || [],
      images: room.images || [],
      note: room.note || '',
      availableDate: room.availableDate || null,
      propertyId: room.propertyId,
      property: room.property ? { id: room.property.id, name: room.property.name } : null,
      tenant: activeTenant ? {
        id: activeTenant.id,
        name: activeTenant.name,
        phone: activeTenant.phone || '',
        rentDay: activeTenant.rentDay,
        payMonths: activeTenant.payMonths ?? 1,
        contractEndDate: activeTenant.contractEndDate || '',
        moveInDate: activeTenant.moveInDate || '',
        deposit: activeTenant.deposit || 0,
        note: activeTenant.note || '',
        // P0-A: 入住实收信息（前端 add-tenant 编辑回填用）
        initialPaymentMethod: activeTenant.initialPaymentMethod || null,
        initialPaymentDate: activeTenant.initialPaymentDate || null,
        initialPaymentAmount: activeTenant.initialPaymentAmount != null
          ? Number(activeTenant.initialPaymentAmount)
          : null,
        initialDepositAmount: activeTenant.initialDepositAmount != null
          ? Number(activeTenant.initialDepositAmount)
          : null,
        // P0-C: 入住水电读数（退租时对照展示）
        moveInReading: activeTenant.moveInReading || '',
        moveOutReading: activeTenant.moveOutReading || '',
      } : null,
      // P0-B: 预付租金退还预览（如果今天退租）
      moveOutPreview: activeTenant ? {
        prepaidRefund: prepaidRefundPreview,
        latestPaidPeriodEnd,
      } : null,
      // Partial-payment warning for checkout confirm modal
      activePartialPayment,
      outstandingDebt: Math.round(outstandingDebt * 100) / 100,
      feeItems: feeRulesToResponse(feeItems),
      historyTenants: tenants
        .filter(t => t.status !== 1)
        .map(t => ({
          id: t.id,
          name: t.name,
          phone: t.phone || '',
          moveInDate: t.moveInDate || '',
          moveOutDate: t.moveOutDate || '',
        })),
      latestBill: latestBill ? {
        id: latestBill.id,
        period: latestBill.period,
        totalAmount: Number(latestBill.totalAmount) || 0,
        status: latestBill.status,
      } : null,
      displayStatus,
    };
  }

  /** Create room */
  async create(propertyId: number, dto: CreateRoomDto): Promise<Room> {
    const cleanDto = { ...dto };
    // available_date column is DATE; legacy clients sent '随时可入住' as a sentinel string.
    if (cleanDto.availableDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDto.availableDate)) {
      delete cleanDto.availableDate;
    }
    const room = this.roomRepository.create({
      ...cleanDto,
      propertyId,
      status: dto.status ?? 0,
    });
    return this.roomRepository.save(room);
  }

  /** Update room (handles checkout action) */
  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    if (dto.action === 'archive' || dto.action === 'restore') {
      if (await this.tenantRepository.existsBy({ roomId: id, status: 1 })) {
        throw new BadRequestException('房间有在租租客，请先办理退租');
      }
      if (dto.action === 'restore' && room.status !== 2) throw new BadRequestException('这个房间没有被隐藏');
      room.status = dto.action === 'archive' ? 2 : 0;
      return this.roomRepository.save(room);
    }
    if (room.status === 2) throw new BadRequestException('请先让这个房间重新显示');
    if (dto.action === 'checkout') {
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: id, status: 1 },
      });
      if (activeTenant) {
        await this.tenantService.moveOut(activeTenant.id, {
          moveOutDate: dayjs().format('YYYY-MM-DD'),
          depositStatus: dto.depositStatus,
          depositRefundAmount: dto.depositRefundAmount,
          depositDeductReason: dto.depositDeductReason,
          moveOutReading: dto.moveOutReading,
          prepaidRefundAmount: dto.prepaidRefundAmount,
          debtAction: dto.debtAction,
          debtReason: dto.debtReason,
        });
      } else {
        room.status = 0;
        await this.roomRepository.save(room);
      }
      return this.roomRepository.findOneByOrFail({ id });
    }

    const { action, ...rest } = dto as any;

    if (rest.status === 0) {
      const activeTenant = await this.tenantRepository.findOne({ where: { roomId: id, status: 1 } });
      if (activeTenant) throw new BadRequestException('房间有在租租客，请先办理退租');
    }

    // available_date column is DATE; legacy clients sent '随时可入住' as a sentinel string.
    if (rest.availableDate && !/^\d{4}-\d{2}-\d{2}$/.test(rest.availableDate)) {
      delete rest.availableDate;
    }

    // Prevent setting status=1 (rented) without an active tenant
    if (rest.status === 1 && room.status !== 1) {
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: id, status: 1 },
      });
      if (!activeTenant) {
        throw new BadRequestException('房间没有在租租客，无法标记为已租');
      }
    }

    Object.assign(room, rest);
    return this.roomRepository.save(room);
  }

  /** Delete room */
  async remove(id: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    const activeTenant = await this.tenantRepository.findOne({
      where: { roomId: id, status: 1 },
    });
    if (activeTenant) {
      throw new BadRequestException('房间有在租租客，无法删除');
    }

    await this.roomRepository.manager.transaction(async (manager) => {
      for (const entity of [Bill, Tenant, RentRecord, SingleCharge, Document, UtilityReading]) {
        if (await manager.count(entity, { where: { roomId: id } })) {
          throw new BadRequestException('这个房间有以前的账，不能永久删除。请使用“暂时不管理这个房间”');
        }
      }
      const bills = await manager.find(Bill, {
        where: { roomId: id },
        select: ['id'],
      });
      const billIds = bills.map(b => b.id);

      if (billIds.length > 0) {
        await manager.delete(BillItem, { billId: In(billIds) });
      }

      await manager.delete(RentRecord, { roomId: id });
      await manager.delete(SingleCharge, { roomId: id });
      await manager.delete(UtilityReading, { roomId: id });
      await manager.delete(Bill, { roomId: id });
      await manager.delete(Document, { roomId: id });
      await manager.delete(FeeItem, { roomId: id });
      await manager.delete(Tenant, { roomId: id });
      await manager.delete(Room, { id });
    });
  }
}
