import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../room/room.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('single_charge')
export class SingleCharge {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'room_id', type: 'bigint', unsigned: true })
  roomId: number;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId: number;

  @Column({ name: 'fee_type', length: 32 })
  feeType: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  status: number;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Room, room => room.singleCharges)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
