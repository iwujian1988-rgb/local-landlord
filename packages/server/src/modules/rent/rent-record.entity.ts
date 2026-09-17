import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Room } from '../room/room.entity';
import { Bill } from '../bill/bill.entity';

@Entity('rent_record')
@Index(['roomId'])
@Index(['billId'])
export class RentRecord {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'room_id', type: 'integer' })
  roomId: number;

  @Column({ name: 'bill_id', type: 'integer', nullable: true })
  billId: number | null;

  @Column({ type: 'tinyint', unsigned: true })
  type: number;

  @Column({ length: 128 })
  title: string;

  @Column({ length: 512, nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  // The date on which cash actually moved. Legacy rows fall back to createdAt
  // in reports, while imported/initial payments can retain their real date.
  @Column({ name: 'payment_at', type: 'datetime', nullable: true })
  paymentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Room, room => room.rentRecords)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => Bill)
  @JoinColumn({ name: 'bill_id' })
  bill: Bill;
}
