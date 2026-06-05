import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../room/room.entity';

@Entity('fee_item')
export class FeeItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'room_id', type: 'bigint', unsigned: true })
  roomId: number;

  @Column({ length: 32 })
  name: string;

  @Column({ type: 'tinyint', unsigned: true })
  type: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  enabled: number;

  @Column({ name: 'is_rent', type: 'tinyint', unsigned: true, default: 0 })
  isRent: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Room, room => room.feeItems)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
