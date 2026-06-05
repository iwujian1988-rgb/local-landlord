import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, EntityManager, In } from 'typeorm';
import * as dayjs from 'dayjs';
import { Bill } from './bill.entity';
import { BillItem } from './bill-item.entity';
import { RentRecord } from '../rent/rent-record.entity';
import { Tenant } from '../tenant/tenant.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class BillService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillItem)
    private readonly billItemRepository: Repository<BillItem>,
    @InjectRepository(RentRecord)
    private readonly rentRecordRepository: Repository<RentRecord>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /** 生成/发送账单（事务包裹） */
  async create(roomId: number, dto: CreateBillDto): Promise<Bill> {
    return this.entityManager.transaction(async (manager) => {
      // 获取当前在租的租客
      const tenant = await manager.findOne(Tenant, {
        where: { roomId, status: 1 },
      });
      if (!tenant) throw new BadRequestException('房间没有在租租客，无法生成账单');

      // 检查是否已存在同周期的账单
      const existingBill = await manager.findOne(Bill, {
        where: { roomId, period: dto.period },
      });
      if (existingBill) {
        throw new BadRequestException('该周期已存在账单');
      }

      // 计算总金额
      const totalAmount = dto.items.reduce((sum, item) => sum + Number(item.amount), 0);

      // 创建账单
      const bill = manager.create(Bill, {
        roomId,
        tenantId: tenant.id,
        period: dto.period,
        totalAmount,
        status: 0, // 未支付
        photos: dto.photos || [],
        sentAt: new Date(), // 创建即发送
      });
      const savedBill = await manager.save(bill);

      // 创建账单明细
      const billItems = dto.items.map(item =>
        manager.create(BillItem, {
          billId: savedBill.id,
          feeName: item.feeName,
          amount: item.amount,
        }),
      );
      await manager.save(billItems);

      return manager.findOne(Bill, {
        where: { id: savedBill.id },
        relations: ['items', 'tenant', 'room'],
      });
    });
  }

  /** 获取账单详情（含 bill_items） */
  async findOne(id: number): Promise<Bill> {
    const bill = await this.billRepository.findOne({
      where: { id },
      relations: ['items', 'tenant', 'room'],
    });
    if (!bill) throw new NotFoundException('账单不存在');
    return bill;
  }

  /** 确认收款（更新 bill status + 创建 rent_record，事务包裹） */
  async confirmPayment(id: number, dto: ConfirmPaymentDto): Promise<Bill> {
    return this.entityManager.transaction(async (manager) => {
      const bill = await manager.findOne(Bill, {
        where: { id },
        relations: ['items', 'tenant', 'room'],
      });
      if (!bill) throw new NotFoundException('账单不存在');

      if (bill.status === 1) {
        throw new BadRequestException('该账单已确认收款');
      }

      // 更新账单状态
      bill.status = 1; // 已支付
      bill.paidAt = new Date();
      await manager.save(bill);

      // 创建收租记录（type=1 租金收入）
      const rentRecord = manager.create(RentRecord, {
        roomId: bill.roomId,
        billId: bill.id,
        type: 1, // 租金收入
        title: `收租-${bill.period}`,
        description: dto.paymentNote || `确认收款: ${bill.totalAmount}`,
        amount: dto.actualAmount ?? bill.totalAmount,
      });
      await manager.save(rentRecord);

      return bill;
    });
  }

  /** 发送账单（标记 sent_at） */
  async sendBill(id: number): Promise<Bill> {
    const bill = await this.findOne(id);
    if (!bill) throw new NotFoundException('账单不存在');
    bill.sentAt = new Date();
    return this.billRepository.save(bill);
  }

  /** 账单列表 */
  async findByRoom(roomId: number): Promise<Bill[]> {
    return this.billRepository.find({
      where: { roomId },
      relations: ['items', 'tenant'],
      order: { createdAt: 'DESC' },
    });
  }

  /** 定时任务：每天0点扫描未支付账单，标记逾期 */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markOverdueBills(): Promise<void> {
    const now = dayjs();
    const today = now.date(); // 当前日期（1-31）

    // 查询所有未支付的账单
    const unpaidBills = await this.billRepository.find({
      where: { status: 0 },
      relations: ['tenant'],
    });

    const overdueBillIds: number[] = [];

    for (const bill of unpaidBills) {
      if (!bill.tenant) continue;

      const rentDay = bill.tenant.rentDay ?? 10;
      let dueDay: number;

      // rentDay=0 表示月底，取当月最后一天
      if (rentDay === 0) {
        // 从 bill.period 解析出月份，获取该月最后一天
        const periodDate = dayjs(bill.period + '-01');
        dueDay = periodDate.endOf('month').date();
      } else {
        dueDay = rentDay;
      }

      // 解析 bill.period（格式：YYYY-MM）判断是否跨月
      const periodDate = dayjs(bill.period + '-01');
      const currentMonth = now.month(); // 0-11
      const currentYear = now.year();
      const billMonth = periodDate.month();
      const billYear = periodDate.year();

      // 账单月份在当前月之前，直接判断为逾期
      if (billYear < currentYear || (billYear === currentYear && billMonth < currentMonth)) {
        overdueBillIds.push(bill.id);
      }
      // 账单月份是当前月，判断是否超过 rentDay
      else if (billYear === currentYear && billMonth === currentMonth) {
        if (today > dueDay) {
          overdueBillIds.push(bill.id);
        }
      }
    }

    if (overdueBillIds.length > 0) {
      await this.billRepository.update(
        { id: In(overdueBillIds) },
        { status: 2 },
      );
    }
  }
}
