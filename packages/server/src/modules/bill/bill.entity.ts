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

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  status: number;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

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
