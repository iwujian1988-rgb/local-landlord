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

  /** 收租统计 V2：支持周期、单房源过滤，并排除纯空置房应收 */
  async getRentStatsV2(landlordId: number, period: string = 'month', propertyId?: number) {
    const now = new Date();
    const periodInfo = this.resolveStatsPeriod(period, now);

    const propertyWhere: any = { landlordId };
    if (propertyId && Number.isFinite(propertyId)) {
      propertyWhere.id = propertyId;
    }

    const properties = await this.propertyRepository.find({ where: propertyWhere });
    const propertyIds = properties.map(p => p.id);
    const allRooms = propertyIds.length > 0
      ? await this.roomRepository.find({ where: { propertyId: In(propertyIds) } })
      : [];
    const allRoomIds = allRooms.map(r => r.id);

    const confirmedSingleByRoom = new Map<number, number>();
    const pendingSingleByRoom = new Map<number, number>();
    if (allRoomIds.length > 0) {
      const singles = await this.singleChargeRepository
        .createQueryBuilder('sc')
        .where('sc.room_id IN (:...ids)', { ids: allRoomIds })
        .andWhere(
          '((sc.status = 1 AND sc.paid_at >= :start AND sc.paid_at < :end) ' +
          'OR (sc.status = 0 AND sc.created_at >= :start AND sc.created_at < :end))',
          { start: periodInfo.startDate, end: periodInfo.endDate },
        )
        .getMany();
      for (const s of singles) {
        const amount = Number(s.amount) || 0;
        if (s.status === 1) {
          confirmedSingleByRoom.set(s.roomId, (confirmedSingleByRoom.get(s.roomId) || 0) + amount);
        } else {
          pendingSingleByRoom.set(s.roomId, (pendingSingleByRoom.get(s.roomId) || 0) + amount);
        }
      }
    }

    const refundByProperty = await this.getRefundsByPropertyForStats(propertyIds, periodInfo.startDate, periodInfo.endDate);

    const roomsByProperty = new Map<number, Room[]>();
    for (const room of allRooms) {
      const list = roomsByProperty.get(room.propertyId) || [];
      list.push(room);
      roomsByProperty.set(room.propertyId, list);
    }

    const propStats: any[] = [];

    for (const prop of properties) {
      const rooms = roomsByProperty.get(prop.id) || [];
      let expected = 0;
      let collected = 0;
      let pending = 0;
      let received = 0;
      let overdue = 0;

      for (const room of rooms) {
        const tenant = await this.tenantRepository.findOne({
          where: { roomId: room.id, status: 1 },
        });
        const bills = await this.billRepository
          .createQueryBuilder('bill')
          .where('bill.room_id = :roomId', { roomId: room.id })
          .andWhere('bill.status != :cancelled', { cancelled: 4 })
          .andWhere('bill.period <= :endMonth', { endMonth: periodInfo.endMonth })
          .andWhere('COALESCE(bill.period_end, bill.period) >= :startMonth', { startMonth: periodInfo.startMonth })
          .orderBy('bill.period', 'ASC')
          .getMany();

        const billCoveredMonths = new Set<string>();
        for (const bill of bills) {
          const billTotal = Number(bill.totalAmount) || 0;
          expected += billTotal;

          for (const m of periodInfo.months) {
            if (bill.period <= m && (bill.periodEnd || bill.period) >= m) {
              billCoveredMonths.add(m);
            }
          }

          if (bill.status === 1) {
            collected += billTotal;
            received++;
          } else if (bill.status === 3) {
            const paid = Number(bill.paidAmount) || 0;
            const remaining = Math.max(billTotal - paid, 0);
            collected += paid;
            pending += remaining;
            received++;
            if (remaining > 0 && this.isBillOverdueForStats(bill, tenant, now)) {
              overdue++;
            }
          } else {
            pending += billTotal;
            if (this.isBillOverdueForStats(bill, tenant, now)) {
              overdue++;
            }
          }
        }

        // Vacant rooms must not create receivables. Historical bills above are
        // still counted, so old/moved-out bills remain auditable.
        if (tenant) {
          const fees = await this.feeItemRepository.find({ where: { roomId: room.id } });
          const rent = Number(room.rent) || 0;
          const payMonths = tenant.payMonths ?? 1;
          const cycleExpected = this.getEstimatedCycleExpectedForStats(fees, rent, payMonths);

          for (const month of periodInfo.months) {
            if (billCoveredMonths.has(month)) continue;
            if (!this.isTenantDueMonthForStats(tenant, month, payMonths)) continue;

            expected += cycleExpected;
            pending += cycleExpected;
            if (this.isEstimatedReceivableOverdueForStats(month, tenant, now)) {
              overdue++;
            }
          }
        }

        const confirmedSingleForRoom = confirmedSingleByRoom.get(room.id) || 0;
        if (confirmedSingleForRoom > 0) {
          expected += confirmedSingleForRoom;
          collected += confirmedSingleForRoom;
          received++;
        }
        const pendingSingleForRoom = pendingSingleByRoom.get(room.id) || 0;
        if (pendingSingleForRoom > 0) {
          expected += pendingSingleForRoom;
          pending += pendingSingleForRoom;
          if (tenant && this.isEstimatedReceivableOverdueForStats(this.formatStatsMonth(now), tenant, now)) {
            overdue++;
          }
        }
      }

      const refund = refundByProperty.get(prop.id) || 0;
      if (refund > 0) {
        collected -= refund;
      }

      if (expected > 0 || collected !== 0 || pending > 0) {
        propStats.push({
          name: prop.name,
          rooms: rooms.length,
          received,
          overdue,
          expected,
          collected,
          pending,
          refund,
          rate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
        });
      }
    }

    const totalExpected = propStats.reduce((s, p) => s + p.expected, 0);
    const totalCollected = propStats.reduce((s, p) => s + p.collected, 0);
    const totalPending = propStats.reduce((s, p) => s + p.pending, 0);

    return {
      period: periodInfo.startMonth,
      monthLabel: periodInfo.label,
      totalExpected,
      totalCollected,
      totalPending,
      totalRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0,
      propertyStats: propStats,
      periodComparison: {
        current: totalCollected,
        lastMonth: 0,
        quarter: 0,
        year: 0,
      },
    };
  }

  private resolveStatsPeriod(period: string, now: Date) {
    const year = now.getFullYear();
    const month = now.getMonth();
    let start = new Date(year, month, 1);
    let monthsCount = 1;
    let label = `${year} 年 ${month + 1} 月`;

    if (/^\d{4}-\d{2}$/.test(period)) {
      const [periodYear, periodMonth] = period.split('-').map(Number);
      start = new Date(periodYear, periodMonth - 1, 1);
      label = `${periodYear} 年 ${periodMonth} 月`;
    } else if (period === 'lastMonth') {
      start = new Date(year, month - 1, 1);
      label = `${start.getFullYear()} 年 ${start.getMonth() + 1} 月`;
    } else if (period === 'quarter') {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      start = new Date(year, quarterStartMonth, 1);
      monthsCount = 3;
      label = `${year} 年第 ${Math.floor(month / 3) + 1} 季度`;
    } else if (period === 'year') {
      start = new Date(year, 0, 1);
      monthsCount = month + 1;
      label = `${year} 年`;
    }

    const months = Array.from({ length: monthsCount }, (_, i) => this.formatStatsMonth(this.addStatsMonths(start, i)));
    const endDate = this.addStatsMonths(start, monthsCount);

    return {
      startDate: start,
      endDate,
      months,
      startMonth: months[0],
      endMonth: months[months.length - 1],
      label,
    };
  }

  private formatStatsMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private addStatsMonths(date: Date, count: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
  }

  private getEstimatedCycleExpectedForStats(fees: FeeItem[], rent: number, payMonths: number): number {
    let total = 0;
    for (const f of fees) {
      if (!f.enabled) continue;
      if (f.type === 0) {
        total += (Number(f.amount) || 0) * payMonths;
      }
    }
    return total > 0 ? total : rent * payMonths;
  }

  private isTenantDueMonthForStats(tenant: Tenant, month: string, payMonths: number): boolean {
    if (!tenant.moveInDate) return true;
    const moveIn = new Date(tenant.moveInDate);
    const [year, monthNumber] = month.split('-').map(Number);
    const monthsSinceMoveIn = (year - moveIn.getFullYear()) * 12 + ((monthNumber - 1) - moveIn.getMonth());
    return monthsSinceMoveIn >= 0 && monthsSinceMoveIn % payMonths === 0;
  }

  private isBillOverdueForStats(bill: Bill, tenant: Tenant | null, now: Date): boolean {
    return this.isEstimatedReceivableOverdueForStats(bill.period, tenant, now);
  }

  private isEstimatedReceivableOverdueForStats(month: string, tenant: Tenant | null, now: Date): boolean {
    const [year, monthNumber] = month.split('-').map(Number);
    const rentDay = tenant?.rentDay ?? 10;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const dueDay = rentDay === 0 ? lastDay : Math.min(rentDay, lastDay);
    const dueDate = new Date(year, monthNumber - 1, dueDay, 23, 59, 59, 999);
    return now.getTime() > dueDate.getTime();
  }

  private async getRefundsByPropertyForStats(propertyIds: number[], startDate: Date, endDate: Date): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (propertyIds.length === 0) return result;

    const movedOutTenants = await this.tenantRepository
      .createQueryBuilder('tenant')
      .innerJoin(Room, 'room', 'room.id = tenant.room_id')
      .where('room.property_id IN (:...propertyIds)', { propertyIds })
      .andWhere('tenant.status = 0')
      .andWhere('tenant.move_out_date >= :start AND tenant.move_out_date < :end', {
        start: this.formatStatsDate(startDate),
        end: this.formatStatsDate(endDate),
      })
      .select('room.property_id', 'propertyId')
      .addSelect('tenant.deposit_refund_amount', 'depositRefundAmount')
      .addSelect('tenant.prepaid_refund_amount', 'prepaidRefundAmount')
      .getRawMany();

    for (const row of movedOutTenants) {
      const propertyId = Number(row.propertyId);
      const amount = (Number(row.depositRefundAmount) || 0) + (Number(row.prepaidRefundAmount) || 0);
      if (propertyId && amount > 0) {
        result.set(propertyId, (result.get(propertyId) || 0) + amount);
      }
    }
    return result;
  }

  private formatStatsDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

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
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let todoCount = 0;
    let pendingHouseholds = 0;
    const descParts: string[] = [];

    for (const room of allRooms) {
      if (room.status !== 1 || allRoomIds.length === 0) continue; // skip vacant rooms

      const tenant = await this.tenantRepository.findOne({
        where: { roomId: room.id, status: 1 },
      });
      const rentDay = tenant?.rentDay ?? 10;
      const dueDay = rentDay === 0 ? lastDayOfMonth : Math.min(rentDay, lastDayOfMonth);
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
      } else if (bill && bill.status !== 1 && today > dueDay) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}已逾期${today - dueDay}天`);
      } else if (!bill && today > dueDay) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}已逾期${today - dueDay}天`);
      } else if (today === dueDay) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}今天该收`);
      } else if (dueDay > today && dueDay - today <= 3) {
        todoCount++;
        pendingHouseholds++;
        descParts.push(`${tenant?.name || room.name}还有${dueDay - today}天`);
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

      const refundByProperty = await this.getRefundsByPropertyForStats(propertyIds, monthStart, monthEnd);
      for (const refund of refundByProperty.values()) {
        monthlyCollected -= refund;
      }
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
