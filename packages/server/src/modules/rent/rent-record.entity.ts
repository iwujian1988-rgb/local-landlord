import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';

@Entity('rent_record')
export class RentRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'room_id', type: 'bigint', unsigned: true })
  roomId: number;

  @Column({ name: 'bill_id', type: 'bigint', unsigned: true, nullable: true })
  billId: number;

  @Column({ type: 'tinyint', unsigned: true })
  type: number;

  @Column({ length: 128 })
  title: string;

  @Column({ length: 512, nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Room, room => room.rentRecords)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Bill)
  @JoinColumn({ name: 'bill_id' })
  bill: Bill;
}
