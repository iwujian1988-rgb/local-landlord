import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';
import { BillItem } from './bill-item.entity';

@Entity('bill')
@Index(['roomId'])
@Index(['tenantId'])
@Index(['status'])
@Index(['period'])
export class Bill {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'room_id', type: 'integer' })
  roomId: number;

  @Column({ name: 'tenant_id', type: 'integer' })
  tenantId: number;

  @Column({ length: 7 })
  period: string;

  // 多月账单的结束月（含）。如押一付三季度账单 period=2024-09, period_end=2024-11。
  // 旧账单该字段为 null，按单月 (period) 处理。
  @Column({ name: 'period_end', type: 'varchar', length: 7, nullable: true })
  periodEnd: string | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  // 0: pending (未收), 1: paid (已收), 2: overdue (逾期), 3: partial (部分付款),
  // 4: cancelled (退租作废 — 租客退租时未付清的账单被关闭，不再催收/统计)
  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  status: number;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Room, room => room.bills)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => BillItem, billItem => billItem.bill)
  items: BillItem[];
}
