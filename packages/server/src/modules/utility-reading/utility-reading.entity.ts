import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** One water or electricity record for one tenant, room and billing month. */
@Entity('utility_reading')
@Index(['roomId', 'tenantId', 'period', 'utilityType'], { unique: true })
@Index(['roomId', 'period'])
export class UtilityReading {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'room_id', type: 'integer' })
  roomId: number;

  @Column({ name: 'tenant_id', type: 'integer' })
  tenantId: number;

  /** YYYY-MM */
  @Column({ length: 7 })
  period: string;

  /** 0 water, 1 electricity */
  @Column({ name: 'utility_type', type: 'tinyint', unsigned: true })
  utilityType: number;

  /** 0 do not charge, 1 enter the total manually, 2 calculate from meter readings */
  @Column({ name: 'charge_mode', type: 'tinyint', unsigned: true, default: 0 })
  chargeMode: number;

  @Column({ name: 'previous_reading', type: 'decimal', precision: 12, scale: 2, nullable: true })
  previousReading: number | null;

  @Column({ name: 'current_reading', type: 'decimal', precision: 12, scale: 2, nullable: true })
  currentReading: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  usage: number | null;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 4, nullable: true })
  unitPrice: number | null;

  /** Final amount copied into the bill. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @Column({ type: 'varchar', length: 256, nullable: true })
  note: string | null;

  @Column({ name: 'bill_id', type: 'integer', nullable: true })
  billId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
