import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Property } from '../property/property.entity';

interface RentStatsItem {
  propertyId: number;
  propertyName: string;
  totalRent: number;
  collectedRent: number;
  pendingRent: number;
  collectionRate: number;
}

export interface PeriodStats {
  period: string;
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  rate: number;
  properties: RentStatsItem[];
}

export interface HomeStats {
  greeting: string;
  todoCount: number;
  pendingTenantCount: number;
  monthlyCollected: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  /** 收租统计（按 period：month/quarter/year） */
  async getRentStats(landlordId: number, period: string = 'month'): Promise<PeriodStats> {
    const now = new Date();
    const periods: string[] = [];

    if (period === 'month') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (period === 'quarter') {
      for (let i = 3; i >= 0; i--) {
        const q = Math.ceil((now.getMonth() + 1) / 3) - i;
        const year = now.getFullYear() + Math.floor((now.getMonth() + 1 - q * 3) / 12);
        const actualQ = ((q - 1) % 4 + 4) % 4 + 1;
        periods.push(`${year}-Q${actualQ}`);
      }
    } else {
      for (let i = 2; i >= 0; i--) {
        periods.push(`${now.getFullYear() - i}`);
      }
    }

    // 获取该房东的所有房源
    const properties = await this.propertyRepository.find({
      where: { landlordId },
    });

    // 当前周期
    const currentPeriod = periods[periods.length - 1];

    const propertyStats: RentStatsItem[] = [];

    for (const property of properties) {
      const rooms = await this.roomRepository.find({
        where: { propertyId: property.id },
      });

      let totalRent = 0;
      let collectedRent = 0;
      let pendingRent = 0;

      for (const room of rooms) {
        const bills = await this.billRepository.find({
          where: { roomId: room.id },
        });

        for (const bill of bills) {
          const billTotal = Number(bill.totalAmount) || 0;

          if (period === 'month' && bill.period === currentPeriod) {
            totalRent += billTotal;
            if (bill.status === 1) {
              collectedRent += billTotal;
            } else {
              pendingRent += billTotal;
            }
          } else if (period === 'year') {
            const billYear = bill.period.slice(0, 4);
            if (billYear === currentPeriod) {
              totalRent += billTotal;
              if (bill.status === 1) {
                collectedRent += billTotal;
              } else {
                pendingRent += billTotal;
              }
            }
          }
        }

        // 如果没有账单，用房间租金计算预期
        if (totalRent === 0) {
          totalRent = Number(room.rent) || 0;
        }
      }

      propertyStats.push({
        propertyId: property.id,
        propertyName: property.name,
        totalRent,
        collectedRent,
        pendingRent,
        collectionRate: totalRent > 0 ? Math.round((collectedRent / totalRent) * 100) : 0,
      });
    }

    const totalExpected = propertyStats.reduce((s, p) => s + p.totalRent, 0);
    const totalCollected = propertyStats.reduce((s, p) => s + p.collectedRent, 0);
    const totalPending = propertyStats.reduce((s, p) => s + p.pendingRent, 0);

    return {
      period: currentPeriod,
      totalExpected,
      totalCollected,
      totalPending,
      rate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
      properties: propertyStats,
    };
  }

  /** 首页统计 */
  async getHomeStats(landlordId: number): Promise<HomeStats> {
    const now = new Date();
    const hour = now.getHours();
    let greeting = '早上好';
    if (hour >= 12 && hour < 18) {
      greeting = '下午好';
    } else if (hour >= 18) {
      greeting = '晚上好';
    }

    // 待办数：未支付账单数量
    const properties = await this.propertyRepository.find({
      where: { landlordId },
    });
    const propertyIds = properties.map(p => p.id);

    let todoCount = 0;
    if (propertyIds.length > 0) {
      const rooms = await this.roomRepository
        .createQueryBuilder('room')
        .where('room.propertyId IN (:...ids)', { ids: propertyIds })
        .getMany();
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        todoCount = await this.billRepository
          .createQueryBuilder('bill')
          .where('bill.roomId IN (:...ids)', { ids: roomIds })
          .andWhere('bill.status = 0')
          .getCount();
      }
    }

    // 待处理租客数：即将到期合约的租客
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const todayStr = now.toISOString().slice(0, 10);
    const laterStr = thirtyDaysLater.toISOString().slice(0, 10);

    let pendingTenantCount = 0;
    if (propertyIds.length > 0) {
      const rooms = await this.roomRepository
        .createQueryBuilder('room')
        .where('room.propertyId IN (:...ids)', { ids: propertyIds })
        .getMany();
      const roomIds = rooms.map(r => r.id);

      if (roomIds.length > 0) {
        pendingTenantCount = await this.tenantRepository
          .createQueryBuilder('tenant')
          .where('tenant.roomId IN (:...ids)', { ids: roomIds })
          .andWhere('tenant.status = 1')
          .andWhere('tenant.contractEndDate BETWEEN :start AND :end', {
            start: todayStr,
            end: laterStr,
          })
          .getCount();
      }
    }

    // 本月已收：当月已支付账单金额总和
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthlyCollected = 0;
    if (propertyIds.length > 0) {
      const result = await this.billRepository
        .createQueryBuilder('bill')
        .innerJoin('bill.room', 'room')
        .where('room.propertyId IN (:...ids)', { ids: propertyIds })
        .andWhere('bill.status = 1')
        .andWhere('bill.period = :period', { period: monthStr })
        .select('SUM(bill.totalAmount)', 'total')
        .getRawOne();
      monthlyCollected = Number(result?.total) || 0;
    }

    return { greeting, todoCount, pendingTenantCount, monthlyCollected };
  }
}
