import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Room } from '../room/room.entity';

@Entity('tenant')
@Index(['roomId'])
@Index(['status'])
export class Tenant {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'room_id', type: 'integer' })
  roomId: number;

  @Column({ length: 32 })
  name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'move_in_date', type: 'date' })
  moveInDate: string;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: string | null;

  @Column({ name: 'rent_day', type: 'tinyint', unsigned: true, default: 10 })
  rentDay: number;

  // 押X付Y 中的「付Y」：每次预付几个月房租。1=月付, 3=季付, 6=半年付。
  // 押金单独存 deposit 列（押X × 月租）。账单 cron 按 payMonths 周期生成。
  @Column({ name: 'pay_months', type: 'tinyint', unsigned: true, default: 1 })
  payMonths: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deposit: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  status: number;

  @Column({ name: 'move_out_date', type: 'date', nullable: true })
  moveOutDate: string;

  // Deposit refund tracking (populated on moveOut)
  // 0: 未处理, 1: 已退还
  @Column({ name: 'deposit_status', type: 'tinyint', unsigned: true, default: 0 })
  depositStatus: number;

  @Column({ name: 'deposit_refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositRefundAmount: number;

  @Column({ name: 'deposit_deduct_reason', type: 'varchar', length: 256, nullable: true })
  depositDeductReason: string;

  // ====== 入住实收（P0-A）======
  // 入住当天收到的首期款记录。配合自动建的第一笔账单使用。
  // 收款方式: cash / wechat / alipay / bank。空表示尚未记录实收。
  @Column({ name: 'initial_payment_method', type: 'varchar', length: 20, nullable: true })
  initialPaymentMethod: string | null;

  // 实收日期 (YYYY-MM-DD)。空表示尚未记录实收。
  @Column({ name: 'initial_payment_date', type: 'varchar', length: 10, nullable: true })
  initialPaymentDate: string | null;

  // 实收金额（首期房租部分，不含押金）。空表示尚未记录实收。
  @Column({ name: 'initial_payment_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  initialPaymentAmount: number | null;

  // ====== 水电气读数（P0-C）======
  // 自由文本，如 "电 1234 水 56 气 12"。仅做凭证，不参与自动算费。
  @Column({ name: 'move_in_reading', type: 'varchar', length: 256, nullable: true })
  moveInReading: string | null;

  @Column({ name: 'move_out_reading', type: 'varchar', length: 256, nullable: true })
  moveOutReading: string | null;

  // ====== 退租预付租金退还（P0-B）======
  // 押X付Y 租客提前退租时，未消费周期的预付租金应退还。
  // 由 moveOut 流程自动计算（剩余天数 × 月租/30），存这里供前端展示与对账。
  @Column({ name: 'prepaid_refund_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  prepaidRefundAmount: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Room, room => room.tenants)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
