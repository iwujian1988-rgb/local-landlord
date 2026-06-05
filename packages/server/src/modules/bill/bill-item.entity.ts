import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Bill } from './bill.entity';

@Entity('bill_item')
export class BillItem {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'bill_id', type: 'integer' })
  billId: number;

  @Column({ name: 'fee_name', length: 32 })
  feeName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ManyToOne(() => Bill, bill => bill.items)
  @JoinColumn({ name: 'bill_id' })
  bill: Bill;
}
