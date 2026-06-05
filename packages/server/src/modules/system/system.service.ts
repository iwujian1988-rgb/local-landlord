import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, EntityManager, Like, Between, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin } from './admin.entity';
import { SystemConfig } from './system-config.entity';
import { Property } from '../property/property.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { BillItem } from '../bill/bill-item.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { Landlord } from '../landlord/landlord.entity';

@Injectable()
export class SystemService {
  private readonly defaultSystemParams: Record<string, any> = {
    appName: '本地房东',
    maxRoomPerProperty: 100,
    enableAutoRemind: true,
    remindDays: 3,
    dataRetentionDays: 365,
  };
  private readonly defaultNotifications: Record<string, any> = {
    rentRemind: { enabled: true, template: '您好，{tenantName}，您的房租将于{dueDate}到期，请及时缴纳。' },
    overdueRemind: { enabled: true, template: '您好，{tenantName}，您的房租已逾期{overdueDays}天，请尽快缴纳。' },
    welcomeMsg: { enabled: true, template: '欢迎{tenantName}入住{roomName}！' },
  };

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  // ========== Property management ==========

  async findProperties(page: number, pageSize: number, keyword?: string) {
    const where: any = {};
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }
    const [list, total] = await this.propertyRepository.findAndCount({
      where,
      relations: ['landlord', 'rooms'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    const result = list.map(p => ({
      ...p,
      landlordName: p.landlord?.name || '',
      roomCount: p.rooms?.length || 0,
      rentedCount: p.rooms?.filter(r => r.status === 1).length || 0,
      vacantCount: p.rooms?.filter(r => r.status === 0).length || 0,
    }));
    return { list: result, total, page, pageSize };
  }

  async createProperty(data: Partial<Property>) {
    if (data.landlordId) {
      const count = await this.propertyRepository.count({ where: { landlordId: data.landlordId } });
      const landlord = await this.landlordRepository.findOne({ where: { id: data.landlordId } });
      if (landlord) {
        if (landlord.status === 0) {
          throw new BadRequestException('账号已禁用，无法创建房源');
        }
        const max = landlord.maxProperties ?? 10;
        if (max > 0 && count >= max) {
          throw new BadRequestException(`[30003] 房源数量已达上限（${max}套），无法继续添加`);
        }
      }
    }
    const property = this.propertyRepository.create(data);
    return this.propertyRepository.save(property);
  }

  async updateProperty(id: number, data: Partial<Property>) {
    const property = await this.propertyRepository.findOne({ where: { id } });
    if (!property) throw new NotFoundException('房源不存在');
    Object.assign(property, data);
    return this.propertyRepository.save(property);
  }

  async deleteProperty(id: number) {
    return this.propertyRepository.manager.transaction(async (manager) => {
      const property = await manager.findOne(Property, { where: { id } });
      if (!property) throw new NotFoundException('房源不存在');

      const rentedCount = await manager.count(Room, {
        where: { propertyId: id, status: 1 },
      });
      if (rentedCount > 0) {
        throw new BadRequestException('该房源下有在租房间，无法删除');
      }

      const rooms = await manager.find(Room, {
        where: { propertyId: id },
        select: ['id'],
      });
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        const bills = await manager.find(Bill, {
          where: { roomId: In(roomIds) },
          select: ['id'],
        });
        const billIds = bills.map(b => b.id);

        if (billIds.length > 0) {
          await manager.delete(BillItem, { billId: In(billIds) });
        }

        await manager.delete(RentRecord, { roomId: In(roomIds) });
        await manager.delete(SingleCharge, { roomId: In(roomIds) });
        await manager.delete(Bill, { roomId: In(roomIds) });
        await manager.delete(Document, { roomId: In(roomIds) });
        await manager.delete(FeeItem, { roomId: In(roomIds) });
        await manager.delete(Tenant, { roomId: In(roomIds) });
        await manager.delete(Room, { propertyId: id });
      }

      await manager.remove(Property, property);
    });
  }

  // ========== Room management ==========

  async findRooms(page: number, pageSize: number, keyword?: string, status?: number) {
    const qb = this.roomRepository.createQueryBuilder('room')
      .leftJoinAndSelect('room.property', 'property')
      .leftJoinAndSelect('property.landlord', 'landlord');

    if (keyword) {
      qb.where('room.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (status !== undefined && status !== null && !isNaN(status)) {
      qb.andWhere('room.status = :status', { status });
    }

    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('room.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  async createRoom(data: Partial<Room>) {
    const room = this.roomRepository.create({ ...data, status: data.status ?? 0 });
    return this.roomRepository.save(room);
  }

  async updateRoom(id: number, data: Partial<Room>) {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');
    Object.assign(room, data);
    return this.roomRepository.save(room);
  }

  async updateRoomStatus(id: number, status: number) {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');
    room.status = status;
    return this.roomRepository.save(room);
  }

  async deleteRoom(id: number) {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) throw new NotFoundException('房间不存在');
    if (room.status === 1) throw new BadRequestException('该房间有在租租客，无法删除');
    await this.roomRepository.remove(room);
  }

  // ========== Tenant management ==========

  async findTenants(page: number, pageSize: number, keyword?: string) {
    const qb = this.tenantRepository.createQueryBuilder('tenant')
      .leftJoinAndSelect('tenant.room', 'room')
      .leftJoinAndSelect('room.property', 'property');

    if (keyword) {
      qb.where('tenant.name LIKE :keyword OR tenant.phone LIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('tenant.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  async createTenant(data: Partial<Tenant>) {
    const tenant = this.tenantRepository.create({ ...data, status: data.status ?? 1 });
    return this.tenantRepository.save(tenant);
  }

  async updateTenant(id: number, data: Partial<Tenant>) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    Object.assign(tenant, data);
    return this.tenantRepository.save(tenant);
  }

  async moveOutTenant(id: number, moveOutDate?: string) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    if (tenant.status === 0) throw new BadRequestException('该租客已退租');
    tenant.status = 0;
    tenant.moveOutDate = moveOutDate || new Date().toISOString().slice(0, 10);

    const room = await this.roomRepository.findOne({ where: { id: tenant.roomId } });
    if (room) {
      room.status = 0;
      await this.roomRepository.save(room);
    }

    return this.tenantRepository.save(tenant);
  }

  async deleteTenant(id: number) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租客不存在');
    await this.tenantRepository.remove(tenant);
  }

  // ========== Admin user management ==========

  async findAdmins(page: number, pageSize: number) {
    const [list, total] = await this.adminRepository.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    const safeList = list.map(a => {
      const { password, ...rest } = a;
      return rest;
    });
    return { list: safeList, total, page, pageSize };
  }

  async createAdmin(data: { username: string; password: string; name: string; role?: number }) {
    const existing = await this.adminRepository.findOne({ where: { username: data.username } });
    if (existing) throw new BadRequestException('用户名已存在');

    const hashedPwd = await bcrypt.hash(data.password, 10);
    const admin = this.adminRepository.create({
      username: data.username,
      password: hashedPwd,
      name: data.name,
      role: data.role ?? 1,
      status: 1,
    });
    const saved = await this.adminRepository.save(admin);
    const { password, ...rest } = saved;
    return rest;
  }

  async updateAdmin(id: number, data: { name?: string; role?: number; status?: number }) {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('管理员不存在');
    Object.assign(admin, data);
    const saved = await this.adminRepository.save(admin);
    const { password, ...rest } = saved;
    return rest;
  }

  async resetAdminPassword(id: number, newPassword: string) {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('管理员不存在');
    admin.password = await bcrypt.hash(newPassword, 10);
    const saved = await this.adminRepository.save(admin);
    const { password, ...rest } = saved;
    return rest;
  }

  // ========== Dashboard statistics ==========

  async getDashboardSummary() {
    const totalLandlords = await this.landlordRepository.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNewLandlords = await this.landlordRepository.count({
      where: { createdAt: Between(today, new Date()) } as any,
    });
    const totalProperties = await this.propertyRepository.count();
    const totalRooms = await this.roomRepository.count();
    const rentedRooms = await this.roomRepository.count({ where: { status: 1 } as any });
    const totalTenants = await this.tenantRepository.count({ where: { status: 1 } as any });

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const bills = await this.billRepository.find();
    const monthBills = bills.filter(b => b.period === monthStart);
    const monthExpected = monthBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const monthCollected = monthBills
      .filter(b => b.status === 1)
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const collectionRate = monthExpected > 0 ? Math.round((monthCollected / monthExpected) * 100) : 0;
    const overdueBillCount = monthBills.filter(b => b.status === 2).length;

    return {
      totalLandlords,
      todayNewLandlords,
      totalProperties,
      totalRooms,
      rentedRooms,
      totalTenants,
      monthExpected,
      monthCollected,
      collectionRate,
      overdueBillCount,
    };
  }

  // ========== Bill management (admin view) ==========

  async getAdminBills(
    page: number,
    pageSize: number,
    status?: number,
    propertyId?: number,
    period?: string,
  ) {
    const qb = this.billRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.room', 'room')
      .leftJoinAndSelect('room.property', 'property')
      .leftJoinAndSelect('bill.tenant', 'tenant');

    if (status !== undefined && status !== null && !isNaN(status)) {
      qb.andWhere('bill.status = :status', { status });
    }
    if (propertyId) {
      qb.andWhere('room.propertyId = :propertyId', { propertyId });
    }
    if (period) {
      qb.andWhere('bill.period = :period', { period });
    }

    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('bill.createdAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  async confirmAdminBill(id: number, paidAt?: string) {
    return this.entityManager.transaction(async (manager) => {
      const bill = await manager.findOne(Bill, { where: { id } });
      if (!bill) throw new NotFoundException('账单不存在');
      if (bill.status === 1) {
        throw new BadRequestException('该账单已确认收款');
      }
      bill.status = 1;
      bill.paidAt = paidAt ? new Date(paidAt) : new Date();
      const savedBill = await manager.save(bill);

      const rentRecord = manager.create(RentRecord, {
        roomId: bill.roomId,
        billId: bill.id,
        type: 1,
        title: `收租-${bill.period}`,
        description: `管理员确认收款: ${bill.totalAmount}`,
        amount: bill.totalAmount,
      });
      await manager.save(rentRecord);

      return savedBill;
    });
  }

  async batchConfirmAdminBills(ids: number[], paidAt?: string) {
    return this.entityManager.transaction(async (manager) => {
      const resolvedPaidAt = paidAt ? new Date(paidAt) : new Date();
      let confirmedCount = 0;
      for (const id of ids) {
        const bill = await manager.findOne(Bill, { where: { id } });
        if (bill) {
          if (bill.status === 1) {
            continue;
          }
          bill.status = 1;
          bill.paidAt = resolvedPaidAt;
          await manager.save(bill);
          const rentRecord = manager.create(RentRecord, {
            roomId: bill.roomId,
            billId: bill.id,
            type: 1,
            title: `收租-${bill.period}`,
            description: `管理员批量确认收款: ${bill.totalAmount}`,
            amount: bill.totalAmount,
          });
          await manager.save(rentRecord);
          confirmedCount++;
        }
      }
      return { success: true, count: confirmedCount, total: ids.length };
    });
  }

  async batchRemindAdminBills(ids: number[]) {
    const results: any[] = [];
    for (const id of ids) {
      const bill = await this.billRepository.findOne({ where: { id }, relations: ['tenant', 'room'] });
      if (!bill) {
        results.push({ billId: id, reminded: false, reason: '账单不存在' });
        continue;
      }
      if (bill.status !== 0) {
        results.push({ billId: id, reminded: false, reason: '账单状态不是待支付' });
        continue;
      }
      const title = `催缴提醒-${bill.period}`;
      const existing = await this.rentRecordRepository.findOne({
        where: { billId: bill.id, type: 3, title },
      });
      if (!existing) {
        const rentRecord = this.rentRecordRepository.create({
          roomId: bill.roomId,
          billId: bill.id,
          type: 3,
          title,
          description: `管理员催缴: 账单 ${bill.period}，金额 ${bill.totalAmount}`,
          amount: 0,
        });
        await this.rentRecordRepository.save(rentRecord);
      }
      results.push({
        billId: id,
        reminded: true,
        tenantName: bill.tenant?.name,
        roomName: bill.room?.name,
        period: bill.period,
        amount: bill.totalAmount,
        sentAt: new Date().toISOString(),
      });
    }
    return { success: true, results };
  }

  // ========== Statistics (admin view) ==========

  async getAdminRentStats(period?: string) {
    const allBills = await this.billRepository.find();

    if (period) {
      const periodBills = allBills.filter(b => b.period === period);
      const expected = periodBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const collected = periodBills
        .filter(b => b.status === 1)
        .reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      return {
        list: [{
          period,
          expectedAmount: expected,
          collectedAmount: collected,
          collectionRate: rate,
          billCount: periodBills.length,
          collectedCount: periodBills.filter(b => b.status === 1).length,
        }],
        totalBills: allBills.length,
      };
    }

    const now = new Date();
    const periods = [5, 4, 3, 2, 1, 0].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const stats = periods.map(p => {
      const periodBills = allBills.filter(b => b.period === p);
      const expected = periodBills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const collected = periodBills
        .filter(b => b.status === 1)
        .reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      return {
        period: p,
        expectedAmount: expected,
        collectedAmount: collected,
        collectionRate: rate,
        billCount: periodBills.length,
        collectedCount: periodBills.filter(b => b.status === 1).length,
      };
    });

    return { list: stats, totalBills: allBills.length };
  }

  async getAdminOccupancyStats() {
    const totalRooms = await this.roomRepository.count();
    const rentedRooms = await this.roomRepository.count({ where: { status: 1 } as any });
    const vacantRooms = totalRooms - rentedRooms;
    const occupancyRate = totalRooms > 0 ? Math.round((rentedRooms / totalRooms) * 100) : 0;

    const properties = await this.propertyRepository.find({ relations: ['rooms'] });
    const propertyStats = properties.map(p => {
      const propTotal = p.rooms?.length || 0;
      const propRented = p.rooms?.filter(r => r.status === 1).length || 0;
      return {
        propertyId: p.id,
        propertyName: p.name,
        totalRooms: propTotal,
        rentedRooms: propRented,
        vacancyRate: propTotal > 0 ? Math.round(((propTotal - propRented) / propTotal) * 100) : 0,
      };
    });

    return {
      totalRooms,
      rentedRooms,
      vacantRooms,
      occupancyRate,
      propertyStats,
    };
  }

  async getAdminLandlordActivity() {
    const landlords = await this.landlordRepository.find();

    const activity = landlords.map(l => {
      const daysSinceCreation = Math.floor(
        (Date.now() - (l.createdAt ? new Date(l.createdAt).getTime() : Date.now())) / (1000 * 60 * 60 * 24),
      );
      let activityLevel: string;
      if (daysSinceCreation <= 7) activityLevel = '高活跃';
      else if (daysSinceCreation <= 30) activityLevel = '中活跃';
      else activityLevel = '低活跃';

      return {
        landlordId: l.id,
        name: l.name,
        phone: l.phone,
        propertyCount: 0,
        createdAt: l.createdAt,
        activityLevel,
      };
    });

    return { list: activity, total: activity.length };
  }

  // ========== System settings ==========

  async getNotifications() {
    const config = await this.configRepo.findOne({ where: { key: 'notifications' } });
    return config?.value ?? this.defaultNotifications;
  }

  async updateNotifications(data: Record<string, any>) {
    const existing = await this.configRepo.findOne({ where: { key: 'notifications' } });
    if (existing) {
      existing.value = { ...existing.value, ...data };
      await this.configRepo.save(existing);
      return existing.value;
    }
    const config = this.configRepo.create({ key: 'notifications', value: { ...this.defaultNotifications, ...data } });
    const saved = await this.configRepo.save(config);
    return saved.value;
  }

  async getSystemParams() {
    const config = await this.configRepo.findOne({ where: { key: 'system_params' } });
    return config?.value ?? this.defaultSystemParams;
  }

  async updateSystemParams(data: Record<string, any>) {
    const existing = await this.configRepo.findOne({ where: { key: 'system_params' } });
    if (existing) {
      existing.value = { ...existing.value, ...data };
      await this.configRepo.save(existing);
      return existing.value;
    }
    const config = this.configRepo.create({ key: 'system_params', value: { ...this.defaultSystemParams, ...data } });
    const saved = await this.configRepo.save(config);
    return saved.value;
  }

  // ========== Landlord management ==========

  async getLandlords(page = 1, pageSize = 20, keyword?: string) {
    const where: any = {};
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }
    const [list, total] = await this.landlordRepository.findAndCount({
      where,
      relations: ['properties'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    const result = list.map(l => ({
      ...l,
      propertyCount: (l.properties || []).length,
    }));
    return { list: result, total, page, pageSize };
  }

  async getLandlordDetail(id: number) {
    const landlord = await this.landlordRepository.findOne({
      where: { id },
      relations: ['properties', 'properties.rooms'],
    });
    if (!landlord) throw new NotFoundException('房东不存在');
    const properties = (landlord.properties || []).map(p => ({
      id: p.id,
      name: p.name,
      address: p.address,
      totalRooms: (p.rooms || []).length,
      rentedRooms: (p.rooms || []).filter(r => r.status === 1).length,
    }));
    return { ...landlord, properties };
  }

  async createLandlord(data: { name: string; phone: string; defaultPayeeName?: string; paymentNote?: string; avatar?: string; maxProperties?: number; status?: number }) {
    const landlord = this.landlordRepository.create({
      ...data,
      openId: `admin_${Date.now()}`,
      status: data.status ?? 1,
      avatar: data.avatar ?? undefined,
      maxProperties: data.maxProperties ?? 10,
    });
    return this.landlordRepository.save(landlord);
  }

  async updateLandlord(id: number, data: Partial<Landlord>) {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('房东不存在');
    Object.assign(landlord, data);
    return this.landlordRepository.save(landlord);
  }

  async updateLandlordStatus(id: number, status: number) {
    const landlord = await this.landlordRepository.findOne({ where: { id } });
    if (!landlord) throw new NotFoundException('房东不存在');
    landlord.status = status;
    return this.landlordRepository.save(landlord);
  }

  // ========== Contract management (admin view) ==========

  async findContracts(page: number, pageSize: number, type?: number, roomId?: number) {
    try {
      const qb = this.documentRepository.createQueryBuilder('doc')
        .leftJoinAndSelect('doc.room', 'room');

      if (type !== undefined && type !== null && !isNaN(type)) {
        qb.andWhere('doc.type = :type', { type });
      } else {
        qb.andWhere('doc.type = :type', { type: 1 });
      }

      if (roomId) {
        qb.andWhere('doc.roomId = :roomId', { roomId });
      }

      qb.skip((page - 1) * pageSize).take(pageSize).orderBy('doc.uploadedAt', 'DESC');
      const [list, total] = await qb.getManyAndCount();
      return { list, total, page, pageSize };
    } catch (e: any) {
      console.error('findContracts error:', e.message, e.stack);
      throw e;
    }
  }

  async createContract(data: { roomId: number; name: string; imageUrl: string; note?: string }) {
    const doc = this.documentRepository.create({
      roomId: data.roomId,
      type: 1,
      name: data.name,
      imageUrl: data.imageUrl,
      note: data.note || '',
    });
    return this.documentRepository.save(doc);
  }

  async deleteContract(id: number) {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('合同不存在');
    await this.documentRepository.remove(doc);
  }
}
