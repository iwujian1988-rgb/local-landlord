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

  @Column({ name: 'contract_end_date', type: 'date' })
  contractEndDate: string;

  @Column({ name: 'rent_day', type: 'tinyint', unsigned: true, default: 10 })
  rentDay: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deposit: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  status: number;

  @Column({ name: 'move_out_date', type: 'date', nullable: true })
  moveOutDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Room, room => room.tenants)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
