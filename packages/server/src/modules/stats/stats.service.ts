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
import { SingleCharge } from '../rent/single-charge.entity';

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

export interface VacantRoom {
  roomId: number;
  roomName: string;
  propertyName: string;
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
  firstVacantRoomId: number;
  vacantRooms: VacantRoom[];
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
    @InjectRepository(SingleCharge)
    private readonly singleChargeRepository: Repository<SingleCharge>,
  ) {}

  /** 收租统计 */
  async getRentStats(landlordId: number, period: string = 'month') {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const properties = await this.propertyRepository.find({ where: { landlordId } });

    // Batch-query confirmed single_charges (water/electricity/repair etc.)
    // for this landlord in the current month, grouped by roomId. Avoids N+1
    // inside the room loop below.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const allRoomIds = (await this.roomRepository.find({
      where: { propertyId: In(properties.map(p => p.id)) },
    })).map(r => r.id);
    const singleByRoom = new Map<number, number>();
    if (allRoomIds.length > 0) {
      const singles = await this.singleChargeRepository
        .createQueryBuilder('sc')
        .where('sc.room_id IN (:...ids)', { ids: allRoomIds })
        .andWhere('sc.status = 1')
        .andWhere('sc.paid_at >= :start AND sc.paid_at < :end', { start: monthStart, end: monthEnd })
        .getMany();
      for (const s of singles) {
        singleByRoom.set(s.roomId, (singleByRoom.get(s.roomId) || 0) + (Number(s.amount) || 0));
      }
    }

    const propStats: any[] = [];

    for (const prop of properties) {
      const rooms = await this.roomRepository.find({ where: { propertyId: prop.id } });
      let expected = 0, collected = 0, pending = 0, received = 0, overdue = 0;

      for (const room of rooms) {
        if (period === 'month') {
          // Find any bill covering current month — supports multi-month (押X付Y)
          // bills where period <= monthStr <= periodEnd.
          const bill = await this.billRepository
            .createQueryBuilder('bill')
            .where('bill.room_id = :roomId', { roomId: room.id })
            .andWhere('bill.status != :cancelled', { cancelled: 4 })
            .andWhere(
              '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
              'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
              { monthStr },
            )
            .orderBy('bill.created_at', 'DESC')
            .getOne();
          const tenant = await this.tenantRepository.findOne({
            where: { roomId: room.id, status: 1 },
          });
          const rent = Number(room.rent) || 0;
          const payMonths = tenant?.payMonths ?? 1;

          // Build expected from fee items — × payMonths for押X付Y tenants
          const fees = await this.feeItemRepository.find({ where: { roomId: room.id } });
          let totalExpected = 0;
          for (const f of fees) {
            if (f.enabled) {
              // Fixed items get ×payMonths; manual items contribute 0 (estimated at bill time)
              totalExpected += f.type === 0 ? (Number(f.amount) || 0) * payMonths : 0;
            }
          }
          if (totalExpected === 0) totalExpected = rent * payMonths;

          if (bill) {
            expected += Number(bill.totalAmount) || totalExpected;
            // Include partial payments in collected — keeps "本月已收" truthful
            // even before the cycle completes.
            if (bill.status === 1) {
              collected += Number(bill.totalAmount) || 0;
              received++;
            } else if (bill.status === 3) {
              collected += Number(bill.paidAmount) || 0;
              const remaining = (Number(bill.totalAmount) || 0) - (Number(bill.paidAmount) || 0);
              pending += remaining;
              received++; // counts as "started collecting"
            } else {
              pending += Number(bill.totalAmount) || 0;
              const rentDay = tenant?.rentDay || 10;
              const dayOfMonth = now.getDate();
              if (dayOfMonth > rentDay) overdue++;
            }
          } else {
            expected += totalExpected;
            pending += totalExpected;
          }

          // Include this room's confirmed single_charges (水电维修等单独收款)
          // in collected — keeps "本月已收" aligned with actual cash received.
          const singleForRoom = singleByRoom.get(room.id) || 0;
          if (singleForRoom > 0) {
            collected += singleForRoom;
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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
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
      const payMonths = tenant?.payMonths ?? 1;

      // For multi-month cycles, skip tenants whose current month is not in cycle.
      // (They show up in rent-list's "upcoming" section, not in today's todo.)
      if (tenant && payMonths > 1 && tenant.moveInDate) {
        const moveIn = new Date(tenant.moveInDate);
        const monthsSinceMoveIn = (currentYear - moveIn.getFullYear()) * 12 + (currentMonth - moveIn.getMonth());
        if (monthsSinceMoveIn >= 0 && monthsSinceMoveIn % payMonths !== 0) {
          continue;
        }
      }

      // Find the bill covering current month (multi-month aware)
      const bill = allRoomIds.length > 0
        ? await this.billRepository
            .createQueryBuilder('bill')
            .where('bill.roomId = :roomId', { roomId: room.id })
            .andWhere('bill.status != :cancelled', { cancelled: 4 })
            .andWhere(
              '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
              'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
              { monthStr },
            )
            .getOne()
        : null;

      if (bill && bill.status === 1) continue; // already paid, skip

      // Check if overdue or due (exclude cancelled bills)
      const hasPriorOverdue = allRoomIds.length > 0
        ? (await this.billRepository
            .createQueryBuilder('bill')
            .where('bill.roomId = :roomId', { roomId: room.id })
            .andWhere('bill.status IN (:...statuses)', { statuses: [0, 2, 3] })
            .andWhere('((bill.period_end IS NULL AND bill.period < :current) OR (bill.period_end IS NOT NULL AND bill.period_end < :current))', { current: monthStr })
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

    // Monthly collected — count both paid-in-full and partial payments.
    // Multi-month (押X付Y) bills covering current period are attributed to the
    // current month for stats purposes.
    let monthlyCollected = 0;
    if (allRoomIds.length > 0) {
      const result = await this.billRepository
        .createQueryBuilder('bill')
        .where('bill.roomId IN (:...ids)', { ids: allRoomIds })
        .andWhere('bill.status IN (:...statuses)', { statuses: [1, 3] })
        .andWhere(
          '((bill.period <= :monthStr AND bill.period_end >= :monthStr) ' +
          'OR (bill.period = :monthStr AND bill.period_end IS NULL))',
          { monthStr },
        )
        // Use CASE to pick paidAmount when partial, else totalAmount
        .select('SUM(CASE WHEN bill.status = 3 THEN bill.paid_amount ELSE bill.total_amount END)', 'total')
        .getRawOne();
      monthlyCollected = Number(result?.total) || 0;

      // Add confirmed single_charges (水电维修等) paid this month — these are
      // real cash received but not tracked in the bill table.
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 1);
      const singleResult = await this.singleChargeRepository
        .createQueryBuilder('sc')
        .where('sc.room_id IN (:...ids)', { ids: allRoomIds })
        .andWhere('sc.status = 1')
        .andWhere('sc.paid_at >= :start AND sc.paid_at < :end', { start: monthStart, end: monthEnd })
        .select('SUM(sc.amount)', 'total')
        .getRawOne();
      monthlyCollected += Number(singleResult?.total) || 0;
    }

    // Guide flags
    const showRoomGuide = allRooms.length === 0;

    // Expiring contracts (within 30 days) — also reused for tenant guide logic
    const expiringContracts: ExpiringContract[] = [];
    const activeTenants = allRoomIds.length > 0
      ? await this.tenantRepository.find({ where: { roomId: In(allRoomIds), status: 1 } })
      : [];
    const tenantedRoomIds = new Set(activeTenants.map(t => t.roomId));

    let showTenantGuide = false;
    let firstVacantRoomId = 0;
    if (!showRoomGuide && allRoomIds.length > 0) {
      // Trigger when ANY room lacks an active tenant (vacant or rented-but-missing-tenant-record)
      showTenantGuide = allRooms.some(r => !tenantedRoomIds.has(r.id));
      if (showTenantGuide) {
        // Priority: room marked rented but missing tenant record > first vacant room
        const rentedWithoutTenant = allRooms.find(r => r.status === 1 && !tenantedRoomIds.has(r.id));
        const firstVacant = allRooms.find(r => r.status === 0);
        const target = rentedWithoutTenant || firstVacant;
        if (target) firstVacantRoomId = target.id;
      }
    }

    const qrCount = await this.paymentQrRepository.count({
      where: { landlordId },
    });
    const showQrGuide = !showRoomGuide && qrCount === 0;

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
    const vacantRoomList = vacantRooms.map(r => ({
      roomId: r.id,
      roomName: r.name,
      propertyName: allRooms.find(rr => rr.id === r.id) ? (properties.find(p => p.id === r.propertyId)?.name || '') : '',
    }));
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
      firstVacantRoomId,
      vacantRooms: vacantRoomList,
      expiringContracts,
      discoveryAlerts: discoveryAlerts.slice(0, 5),
    };
  }
}
