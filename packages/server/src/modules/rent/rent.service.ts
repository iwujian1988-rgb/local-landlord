import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { SingleCharge } from './single-charge.entity';
import { RentRecord } from './rent-record.entity';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Bill } from '../bill/bill.entity';
import { CreateSingleChargeDto } from './dto/create-single-charge.dto';
import { RemindTenantDto } from './dto/remind-tenant.dto';

interface PendingRentGroup {
  today: any[];
  expiringSoon: any[];
  overdue: any[];
  completed: any[];
}

@Injectable()
export class RentService {
  constructor(
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
  ) {}

  /**
   * 待处理收租列表：按 today/expiringSoon/overdue/completed 分组
   * 获取所有已出租房间，根据账单状态分类
   */
  async getPendingRent(landlordId: number): Promise<PendingRentGroup> {
    // 获取该房东的所有已出租房间
    const rentedRooms = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.property', 'property')
      .where('property.landlordId = :landlordId', { landlordId })
      .andWhere('room.status = 1')
      .getMany();

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const todayList: any[] = [];
    const expiringSoonList: any[] = [];
    const overdueList: any[] = [];
    const completedList: any[] = [];

    for (const room of rentedRooms) {
      const activeTenant = await this.tenantRepository.findOne({
        where: { roomId: room.id, status: 1 },
      });

      // 获取本月账单
      const currentBill = await this.billRepository.findOne({
        where: { roomId: room.id, period: monthStr },
        relations: ['items'],
      });

      // 获取上月或更早的逾期账单
      const overdueBills = await this.billRepository.find({
        where: { roomId: room.id, status: 0 },
      });
      const trulyOverdue = overdueBills.filter(b => b.period < monthStr);

      const rentEntry = {
        roomId: room.id,
        roomName: room.name,
        rent: room.rent,
        tenantName: activeTenant?.name || '',
        tenantId: activeTenant?.id || null,
        contactEndDate: activeTenant?.contractEndDate || '',
        rentDay: activeTenant?.rentDay || 10,
        billId: currentBill?.id || null,
        billStatus: currentBill?.status ?? null,
        totalAmount: currentBill?.totalAmount || 0,
        hasOverdue: trulyOverdue.length > 0,
      };

      if (currentBill && currentBill.status === 1) {
        // 已支付 -> completed
        completedList.push(rentEntry);
      } else if (trulyOverdue.length > 0) {
        // 有逾期账单
        overdueList.push(rentEntry);
      } else if (currentBill && currentBill.status === 0) {
        // 当月已发账单未付
        const rentDay = activeTenant?.rentDay || 10;
        const dayOfMonth = now.getDate();
        if (dayOfMonth === rentDay) {
          todayList.push(rentEntry);
        } else if (dayOfMonth > rentDay) {
          overdueList.push(rentEntry);
        } else {
          // 不到交租日
          todayList.push(rentEntry);
        }
      } else {
        // 未生成账单
        const contractEnd = activeTenant?.contractEndDate;
        if (contractEnd) {
          const diffDays = Math.ceil(
            (new Date(contractEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays <= 30 && diffDays > 0) {
            expiringSoonList.push(rentEntry);
          } else {
            todayList.push(rentEntry);
          }
        } else {
          todayList.push(rentEntry);
        }
      }
    }

    return {
      today: todayList,
      expiringSoon: expiringSoonList,
      overdue: overdueList,
      completed: completedList,
    };
  }

  /** 创建单独收款 */
  async createSingleCharge(roomId: number, landlordId: number, dto: CreateSingleChargeDto): Promise<SingleCharge> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const tenant = await this.tenantRepository.findOne({
      where: { roomId, status: 1 },
    });
    if (!tenant) throw new BadRequestException('房间没有在租租客');

    const charge = this.singleChargeRepository.create({
      roomId,
      tenantId: tenant.id,
      feeType: dto.feeType,
      amount: dto.amount,
      note: dto.note || '',
      status: 0,
    });
    return this.singleChargeRepository.save(charge);
  }

  /** 确认单独收款 */
  async confirmSingleCharge(id: number): Promise<SingleCharge> {
    const charge = await this.singleChargeRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!charge) throw new NotFoundException('收款记录不存在');

    if (charge.status === 1) {
      throw new BadRequestException('该收款已确认');
    }

    charge.status = 1;
    charge.paidAt = new Date();
    const saved = await this.singleChargeRepository.save(charge);

    // 创建收租记录（type=2 单独收款）
    const rentRecord = this.rentRecordRepository.create({
      roomId: charge.roomId,
      type: 2,
      title: `单独收款-${charge.feeType}`,
      description: charge.note || `单独收款: ${charge.amount}`,
      amount: charge.amount,
    });
    await this.rentRecordRepository.save(rentRecord);

    return saved;
  }

  /** 收租记录列表 */
  async getRecords(roomId: number): Promise<RentRecord[]> {
    return this.rentRecordRepository.find({
      where: { roomId },
      relations: ['bill'],
      order: { createdAt: 'DESC' },
    });
  }

  /** 提醒租客（创建提醒记录 type=4） */
  async remindTenant(roomId: number, dto: RemindTenantDto): Promise<RentRecord> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');

    const rentRecord = this.rentRecordRepository.create({
      roomId,
      type: 4, // 提醒类型
      title: dto.title,
      description: dto.description || '',
      amount: 0,
    });
    return this.rentRecordRepository.save(rentRecord);
  }
}
