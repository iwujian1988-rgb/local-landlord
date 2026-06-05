import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Property } from '../property/property.entity';
import { Tenant } from '../tenant/tenant.entity';
import { FeeItem } from '../fee/fee-item.entity';
import { Bill } from '../bill/bill.entity';
import { SingleCharge } from '../rent/single-charge.entity';
import { Document } from '../document/document.entity';
import { RentRecord } from '../rent/rent-record.entity';

@Entity('room')
@Index(['propertyId'])
@Index(['status'])
export class Room {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'property_id', type: 'integer' })
  propertyId: number;

  @Column({ length: 64 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rent: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  status: number;

  @Column({ name: 'available_date', type: 'date', nullable: true })
  availableDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deposit: number;

  @Column({ length: 32, nullable: true })
  area: string;

  @Column({ length: 32, nullable: true })
  floor: string;

  @Column({ length: 16, nullable: true })
  orientation: string;

  @Column({ type: 'json', nullable: true })
  facilities: string[];

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Property, property => property.rooms)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => Tenant, tenant => tenant.room)
  tenants: Tenant[];

  @OneToMany(() => FeeItem, feeItem => feeItem.room)
  feeItems: FeeItem[];

  @OneToMany(() => Bill, bill => bill.room)
  bills: Bill[];

  @OneToMany(() => SingleCharge, charge => charge.room)
  singleCharges: SingleCharge[];

  @OneToMany(() => Document, document => document.room)
  documents: Document[];

  @OneToMany(() => RentRecord, record => record.room)
  rentRecords: RentRecord[];
}
