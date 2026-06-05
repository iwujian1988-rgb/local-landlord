import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Property } from '../property/property.entity';
import { PaymentQr } from '../payment-qr/payment-qr.entity';

@Entity('landlord')
export class Landlord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'open_id', length: 64, unique: true })
  openId: string;

  @Column({ name: 'union_id', length: 64, nullable: true })
  unionId: string;

  @Column({ length: 32 })
  name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 512, nullable: true })
  avatar: string;

  @Column({ name: 'default_payee_name', length: 32, nullable: true })
  defaultPayeeName: string;

  @Column({ name: 'payment_note', length: 256, nullable: true })
  paymentNote: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  status: number; // 0=禁用, 1=启用

  @Column({ name: 'max_properties', type: 'tinyint', unsigned: true, default: 10 })
  maxProperties: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Property, property => property.landlord)
  properties: Property[];

  @OneToMany(() => PaymentQr, paymentQr => paymentQr.landlord)
  paymentQrs: PaymentQr[];
}
