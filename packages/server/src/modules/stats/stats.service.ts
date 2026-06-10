import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Property } from '../property/property.entity';
import { Landlord } from '../landlord/landlord.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';

export interface ExpiringContract {
  tenantId: number;
  tenantName: string;
  roomName: string;
  roomId: number;
  contractEndDate: string;
  daysLeft: number;
}

export interface DiscoveryAlert {
  type: 'no_deposit' | 'vacant_long' | 'same_rentday' | 'no_contract_date';
  message: string;
  roomId: number;
  roomName: string;
}

export interface HomeStats {
  greeting: string;
  profileName: string;
  todoCount: number;
  pendingHouseholds: number;
  pendingDesc: string;
  monthlyCollected: number;
  showRoomGuide: boolean;
  showTenantGuide: boolean;
  showQrGuide: boolean;
  expiringContracts: ExpiringContract[];
  discoveryAlerts: DiscoveryAlert[];
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
    @InjectRepository(Landlord)
    private readonly landlordRepository: Repository<Landlord>,
    @InjectRepository(FeeItem)
    private readonly feeItemRepository: Repository<FeeItem>,
    @InjectRepository(PaymentQr)
    private readonly paymentQrRepository: Repository<PaymentQr>,
  ) {}

  /** 收租统计 */
  async getRentStats(landlordId: number, period: string = 'month') {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const properties = await this.propertyRepository.find({ where: { landlordId } });
    const propStats: any[] = [];

    for (const prop of properties) {
      const rooms = await this.roomRepository.find({ where: { propertyId: prop.id } });
      let expected = 0, collected = 0, pending = 0, received = 0, overdue = 0;

      for (const room of rooms) {
        if (period === 'month') {
          const bill = await this.billRepository.findOne({
            where: { roomId: room.id, period: monthStr },
          });
          const tenant = await this.tenantRepository.findOne({
            where: { roomId: room.id, status: 1 },
          });
          const rent = Number(room.rent) || 0;

          // Build expected from fee items
          const fees = await this.feeItemRepository.find({ where: { roomId: room.id } });
          let totalExpected = 0;
          for (const f of fees) {
            if (f.enabled) totalExpected += Number(f.amount) || 0;
          }
          if (totalExpected === 0) totalExpected = rent;

          if (bill) {
            expected += Number(bill.totalAmount) || totalExpected;
            if (bill.status === 1) {
              collected += Number(bill.totalAmount) || 0;
              received++;
            } else {
              pending += Number(bill.totalAmount) || 0;
              const rentDay = tenant?.rentDay || 10;
              const dayOfMonth = now.getDate();
              if (dayOfMonth > rentDay) overdue++;  // bill exists and unpaid → overdue is valid
            }
          } else {
            expected += totalExpected;
            pending += totalExpected;
          }
        }
      }

      propStats.push({
        name: prop.name,
        rooms: rooms.length,
        received,
        overdue,
        expected,
        collected,
        pending,
        rate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
      });
    }

    const totalExpected = propStats.reduce((s, p) => s + p.expected, 0);
    const totalCollected = propStats.reduce((s, p) => s + p.collected, 0);
    const totalPending = propStats.reduce((s, p) => s + p.pending, 0);

    const monthNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const monthLabel = `${now.getFullYear()} 年 ${monthNames[now.getMonth()]} 月`;

    // Period comparison
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const allRoomIds = (await this.roomRepository.find({
      where: { propertyId: In(properties.map(p => p.id)) },
    })).map(r => r.id);

    let lastMonthCollected = 0;
    if (allRoomIds.length > 0) {
      const res = await this.billRepository
        .createQueryBuilder('bill')
        .where('bill.roomId IN (:...ids)', { ids: allRoomIds })
        .andWhere('bill.status = 1')
        .andWhere('bill.period = :period', { period: lastMonthStr })
        .select('SUM(bill.totalAmount)', 'total')
        .getRawOne();
      lastMonthCollected = Number(res?.total) || 0;
    }

    return {
      period: monthStr,
      monthLabel,
      totalExpected,
      totalCollected,
      totalPending,
      totalRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0,
      propertyStats: propStats,
      periodComparison: {
        current: totalCollected,
        lastMonth: lastMonthCollected,
        quarter: 0,
        year: 0,
      },
    };
  }

  /** 首页统计 */
  async getHomeStats(landlordId: number): Promise<HomeStats> {
    const now = new Date();
    const hour = now.getHours();
    let greeting = '早上好';
    if (hour < 6) greeting = '凌晨好';
    else if (hour < 9) greeting = '早上好';
    else if (hour < 12) greeting = '上午好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';

    // Get landlord profile
    const landlord = await this.landlordRepository.findOne({ where: { id: landlordId } });
    const profileName = landlord?.name || '';

    // Get all rooms for this landlord
    const properties = await this.propertyRepository.find({ where: { landlordId } });
    const propertyIds = properties.map(p => p.id);
    const allRooms = propertyIds.length > 0
      ? await this.roomRepository.find({ where: { propertyId: In(propertyIds) } })
      : [];
    const allRoomIds = allRooms.map(r => r.id);

    // Compute pending info by iterating rented rooms
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.getDate();
    let todoCount = 0;
    let pendingHouseholds = 0;
    const descParts: string[] = [];

    for (const room of allRooms) {
      if (room.status !== 1 || allRoomIds.length === 0) continue; // skip vacant rooms

      const tenant = await this.tenantRepository.findOne({
        where: { roomId: room.id, status: 1 },
      });
      const rentDay = tenant?.rentDay ?? 10;

      const bill = allRoomIds.length > 0
        ? await this.billRepository.findOne({ where: { roomId: room.id, period: monthStr } })
        : null;

      if (bill && bill.status === 1) continue; // already paid, skip

      // Check if overdue or due
      const hasPriorOverdue = allRoomIds.length > 0
        ? (await this.billRepository
            .createQueryBuilder('bill')
            .where('bill.roomId = :roomId', { roomId: room.id })
            .andWhere('bill.status = 0')
            .andWhere('bill.period < :current', { current: monthStr })
            .getCount()) > 0
        : false;

      if (hasPriorOverdue) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}已逾期`);
      } else if (bill && bill.status !== 1 && today > rentDay) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}已逾期${today - rentDay}天`);
      } else if (today === rentDay) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}今天该收`);
      } else if (rentDay - today <= 3) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}还有${rentDay - today}天`);
      }
    }

    // Monthly collected
    let monthlyCollected = 0;
    if (allRoomIds.length > 0) {
      const result = await this.billRepository
        .createQueryBuilder('bill')
        .where('bill.roomId IN (:...ids)', { ids: allRoomIds })
        .andWhere('bill.status = 1')
        .andWhere('bill.period = :period', { period: monthStr })
        .select('SUM(bill.totalAmount)', 'total')
        .getRawOne();
      monthlyCollected = Number(result?.total) || 0;
    }

    // Guide flags
    const showRoomGuide = allRooms.length === 0;

    let showTenantGuide = false;
    if (!showRoomGuide && allRoomIds.length > 0) {
      const rentedCount = allRooms.filter(r => r.status === 1).length;
      const tenantCount = await this.tenantRepository.count({
        where: { roomId: In(allRoomIds), status: 1 },
      });
      showTenantGuide = rentedCount > tenantCount;
    }

    const qrCount = await this.paymentQrRepository.count({
      where: { landlordId },
    });
    const showQrGuide = !showRoomGuide && qrCount === 0;

    // Expiring contracts (within 30 days)
    const expiringContracts: ExpiringContract[] = [];
    const activeTenants = allRoomIds.length > 0
      ? await this.tenantRepository.find({ where: { roomId: In(allRoomIds), status: 1 } })
      : [];
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    for (const t of activeTenants) {
      if (!t.contractEndDate) continue;
      const endDate = new Date(t.contractEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft >= -30 && daysLeft <= 30) {
        const room = allRooms.find(r => r.id === t.roomId);
        expiringContracts.push({
          tenantId: t.id,
          tenantName: t.name,
          roomName: room?.name || `房间${t.roomId}`,
          roomId: t.roomId,
          contractEndDate: t.contractEndDate,
          daysLeft,
        });
      }
    }

    // Discovery alerts: things the landlord might not know they're missing
    const discoveryAlerts: DiscoveryAlert[] = [];

    for (const t of activeTenants) {
      const room = allRooms.find(r => r.id === t.roomId);
      if (!room) continue;

      // No deposit recorded
      if (!t.deposit || Number(t.deposit) === 0) {
        discoveryAlerts.push({
          type: 'no_deposit',
          message: `${t.name}入住后还没录押金`,
          roomId: room.id,
          roomName: room.name,
        });
      }

      // No contract end date
      if (!t.contractEndDate) {
        discoveryAlerts.push({
          type: 'no_contract_date',
          message: `${t.name}没填合同到期时间`,
          roomId: room.id,
          roomName: room.name,
        });
      }
    }

    // Vacant rooms that have been empty for a while (no active tenant)
    const rentedRoomIds = activeTenants.map(t => t.roomId);
    const vacantRooms = allRooms.filter(r => !rentedRoomIds.includes(r.id));
    for (const room of vacantRooms) {
      discoveryAlerts.push({
        type: 'vacant_long',
        message: `${room.name}空着没租出去`,
        roomId: room.id,
        roomName: room.name,
      });
    }

    // Same rent day for multiple rooms (easy to batch)
    const rentDayGroups: Record<number, string[]> = {};
    for (const t of activeTenants) {
      const day = t.rentDay ?? 1;
      const room = allRooms.find(r => r.id === t.roomId);
      if (!room) continue;
      if (!rentDayGroups[day]) rentDayGroups[day] = [];
      rentDayGroups[day].push(room.name);
    }
    for (const [day, names] of Object.entries(rentDayGroups)) {
      if (names.length >= 3) {
        const dayLabel = day === '0' ? '月底' : `${day}号`;
        discoveryAlerts.push({
          type: 'same_rentday',
          message: `${names.length}间房都是${dayLabel}收租，可以一起收`,
          roomId: 0,
          roomName: '',
        });
        break;
      }
    }

    return {
      greeting,
      profileName,
      todoCount,
      pendingHouseholds,
      pendingDesc: descParts.join('，'),
      monthlyCollected,
      showRoomGuide,
      showTenantGuide,
      showQrGuide,
      expiringContracts,
      discoveryAlerts: discoveryAlerts.slice(0, 5),
    };
  }
}
