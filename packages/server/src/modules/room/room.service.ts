import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import dayjs from 'dayjs';
import { Room } from './room.entity';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

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
  ) {}

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
  async findAllForLandlord(landlordId: number): Promise<any[]> {
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    if (properties.length === 0) return [];

    const propertyIds = properties.map(p => p.id);
    const propertyMap = new Map<number, Property>();
    for (const p of properties) propertyMap.set(p.id, p);

    const rooms = await this.roomRepository.find({
      where: { propertyId: In(propertyIds) },
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
      const fees = (feeMap.get(room.id) || []).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type === 0 ? 'fixed' : 'manual',
        amount: Number(f.amount) || 0,
        enabled: !!f.enabled,
        isRent: !!f.isRent,
      }));

      const rentDay = tenant?.rentDay ?? 10;
      const now = new Date();
      const today = now.getDate();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dueDay = rentDay === 0 ? lastDayOfMonth : Math.min(rentDay, lastDayOfMonth);
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      // Covering bill (multi-month aware), exclude cancelled
      const currentBill = await this.billRepository
        .createQueryBuilder('bill')
        .where('bill.room_id = :rid', { rid: room.id })
        .andWhere('bill.status != :cancelled', { cancelled: 4 })
        .andWhere(
          '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
          'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
          { monthStr },
        )
        .orderBy('bill.created_at', 'DESC')
        .getOne();

      let overdueDays = 0;
      if (room.status === 1 && currentBill && currentBill.status !== 1 && today > dueDay) {
        overdueDays = today - dueDay;
      }

      let displayStatus = 'vacant';
      if (room.status === 1) {
        if (overdueDays > 0) displayStatus = 'overdue';
        else if (dueDay - today >= 1 && dueDay - today <= 3) displayStatus = 'approaching';
        else displayStatus = 'rented';
      }

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

    const where: any = { propertyId };
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
    const today = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Find bills covering current month — multi-month aware (押X付Y bills span
    // period..periodEnd). Exclude cancelled (status=4) so退租 rooms don't show
    // as overdue.
    const currentBills: Bill[] = [];
    if (roomIds.length > 0) {
      for (const rid of roomIds) {
        const bill = await this.billRepository
          .createQueryBuilder('bill')
          .where('bill.room_id = :rid', { rid })
          .andWhere('bill.status != :cancelled', { cancelled: 4 })
          .andWhere(
            '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
            'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
            { monthStr },
          )
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
      const dueDay = rentDay === 0 ? lastDayOfMonth : Math.min(rentDay, lastDayOfMonth);
      let overdueDays = 0;

      let displayStatus = 'vacant';
      if (room.status === 1) {
        const billOverdue = bill && bill.status !== 1 && today > dueDay;
        if (billOverdue) {
          displayStatus = 'overdue';
          overdueDays = today - dueDay;
        } else if (dueDay - today >= 1 && dueDay - today <= 3) {
          displayStatus = 'approaching';
        } else {
          displayStatus = 'rented';
        }
      }

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

    const feeItems = await this.feeItemRepository.find({
      where: { roomId: id },
      order: { sortOrder: 'ASC' },
    });

    const latestBill = await this.billRepository.findOne({
      where: { roomId: id },
      order: { createdAt: 'DESC' },
    });

    // Partial-payment warning: if tenant has any status=3 (partial) bills,
    // surface the total paid amount so the landlord sees "this tenant already
    // paid ¥X, checkout will void the unpaid balance" before confirming.
    let activePartialPayment: { count: number; totalPaid: number } | null = null;
    if (activeTenant) {
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
    const previewNow = new Date();
    let prepaidRefundPreview = 0;
    let latestPaidPeriodEnd: string | null = null;
    if (activeTenant) {
      const latestPaidBill = await this.billRepository.findOne({
        where: { tenantId: activeTenant.id, status: 1 },
        order: { periodEnd: 'DESC' },
      });
      if (latestPaidBill) {
        latestPaidPeriodEnd = latestPaidBill.periodEnd || latestPaidBill.period;
        const periodEndDate = dayjs(latestPaidPeriodEnd + '-01').endOf('month');
        const moveOutDay = dayjs(previewNow); // preview uses today
        const unusedDays = periodEndDate.diff(moveOutDay, 'day');
        if (unusedDays > 0) {
          const monthlyRent = Number(room.rent) || 0;
          if (monthlyRent > 0) {
            const dailyRate = monthlyRent / 30;
            prepaidRefundPreview = Math.round(dailyRate * unusedDays * 100) / 100;
          }
        }
      }
    }

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Covering bill (multi-month aware), exclude cancelled
    const currentBill = await this.billRepository
      .createQueryBuilder('bill')
      .where('bill.room_id = :rid', { rid: id })
      .andWhere('bill.status != :cancelled', { cancelled: 4 })
      .andWhere(
        '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
        'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
        { monthStr },
      )
      .orderBy('bill.created_at', 'DESC')
      .getOne();
    const rentDay = activeTenant?.rentDay ?? 10;
    const today = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dueDay = rentDay === 0 ? lastDayOfMonth : Math.min(rentDay, lastDayOfMonth);
    let overdueDays = 0;
    if (room.status === 1 && currentBill && currentBill.status !== 1 && today > dueDay) {
      overdueDays = today - dueDay;
    }

    let displayStatus = 'vacant';
    if (room.status === 1) {
      if (overdueDays > 0) displayStatus = 'overdue';
      else if (dueDay - today >= 1 && dueDay - today <= 3) displayStatus = 'approaching';
      else displayStatus = 'rented';
    }

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
      feeItems: feeItems.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type === 0 ? 'fixed' : 'manual',
        amount: Number(f.amount) || 0,
        enabled: !!f.enabled,
        isRent: !!f.isRent,
      })),
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
    const room = this.roomRepository.create({
      ...dto,
      propertyId,
      status: dto.status ?? 0,
    });
    return this.roomRepository.save(room);
  }

  /** Update room (handles checkout action) */
  async update(id: number, dto: UpdateRoomDto): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');

    if (dto.action === 'checkout') {
      room.status = 0;
      await this.roomRepository.save(room);
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: id, status: 1 },
      });
      if (activeTenant) {
        activeTenant.status = 0;
        const moveOutDate = new Date().toISOString().slice(0, 10);
        activeTenant.moveOutDate = moveOutDate;

        if (dto.depositStatus != null) {
          activeTenant.depositStatus = dto.depositStatus;
          if (dto.depositRefundAmount != null) {
            activeTenant.depositRefundAmount = dto.depositRefundAmount;
          }
          if (dto.depositDeductReason != null) {
            activeTenant.depositDeductReason = dto.depositDeductReason;
          }
        }

        // P0-C: 退租水电读数
        if (dto.moveOutReading != null) {
          activeTenant.moveOutReading = dto.moveOutReading;
        }

        // P0-B: 预付租金退还 — 前端传则以传值为准，否则后端按 moveOutDate 自动算
        if (dto.prepaidRefundAmount != null) {
          activeTenant.prepaidRefundAmount = dto.prepaidRefundAmount;
        } else {
          activeTenant.prepaidRefundAmount = await this.computePrepaidRefundFor(
            activeTenant,
            moveOutDate,
          );
        }

        await this.tenantRepository.save(activeTenant);

        // P1: Cancel tenant's pending/partial/overdue bills so they don't keep
        // showing in rent-list催收 / stats待收 / overdue cron. Paid bills are
        // kept for history. status=4 means "退租作废".
        await this.billRepository
          .createQueryBuilder()
          .update(Bill)
          .set({ status: 4 })
          .where('tenant_id = :tid', { tid: activeTenant.id })
          .andWhere('status IN (:...statuses)', { statuses: [0, 2, 3] })
          .execute();
      }
      return room;
    }

    const { action, ...rest } = dto as any;

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

  /**
   * P0-B helper: compute prepaid rent refund for an early move-out.
   *
   * Algorithm mirrors TenantService.computePrepaidRefund. Finds the latest paid
   * bill, looks at its periodEnd, computes unused days from moveOutDate to end
   * of that month, multiplies by monthly rent / 30 (standard 日租金 convention).
   */
  private async computePrepaidRefundFor(
    tenant: Tenant,
    moveOutDate: string,
  ): Promise<number> {
    const latestPaidBill = await this.billRepository.findOne({
      where: { tenantId: tenant.id, status: 1 },
      order: { periodEnd: 'DESC' },
    });
    if (!latestPaidBill) return 0;

    const effectivePeriodEnd = latestPaidBill.periodEnd || latestPaidBill.period;
    const periodEndDate = dayjs(effectivePeriodEnd + '-01').endOf('month');
    const moveOutDay = dayjs(moveOutDate);
    const unusedDays = periodEndDate.diff(moveOutDay, 'day');
    if (unusedDays <= 0) return 0;

    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (!room) return 0;
    const monthlyRent = Number(room.rent) || 0;
    if (monthlyRent <= 0) return 0;

    const dailyRate = monthlyRent / 30;
    const refund = Math.round(dailyRate * unusedDays * 100) / 100;
    return Math.max(0, refund);
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
      await manager.delete(Bill, { roomId: id });
      await manager.delete(Document, { roomId: id });
      await manager.delete(FeeItem, { roomId: id });
      await manager.delete(Tenant, { roomId: id });
      await manager.delete(Room, { id });
    });
  }
}
