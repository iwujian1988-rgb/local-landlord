import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Room } from '../room/room.entity';

@Entity('fee_item')
@Index(['roomId'])
export class FeeItem {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'room_id', type: 'integer' })
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

  /**
   * Billing cycle mode for `fixed`-type fees:
   * - 'rent'   — multiplies by payMonths (押一付三 → ×3). Default. Fits 房租/网费/卫生费 etc.
   * - 'monthly'— always charges 1 month regardless of payMonths. Fits 停车管理费/固定服务费 etc.
   *
   * Ignored for `manual`-type fees (their amount is hand-filled at send time).
   */
  @Column({ name: 'cycle_mode', type: 'varchar', length: 16, default: 'rent' })
  cycleMode: string;

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
