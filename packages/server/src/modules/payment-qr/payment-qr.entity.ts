import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Landlord } from '../landlord/landlord.entity';

@Entity('payment_qr')
@Index(['landlordId'])
export class PaymentQr {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'landlord_id', type: 'integer' })
  landlordId: number;

  @Column({ type: 'tinyint', unsigned: true })
  type: number;

  @Column({ name: 'image_url', length: 512, nullable: true })
  imageUrl: string;

  @Column({ name: 'is_default', type: 'tinyint', unsigned: true, default: 0 })
  isDefault: number;

  @Column({ name: 'payee_name', length: 32 })
  payeeName: string;

  @Column({ length: 256, nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Landlord, landlord => landlord.paymentQrs)
  @JoinColumn({ name: 'landlord_id' })
  landlord: Landlord;
}
