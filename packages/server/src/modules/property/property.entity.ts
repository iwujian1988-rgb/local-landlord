import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Landlord } from '../landlord/landlord.entity';
import { Room } from '../room/room.entity';

@Entity('property')
export class Property {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'landlord_id', type: 'bigint', unsigned: true })
  landlordId: number;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 256, nullable: true })
  address: string;

  @Column({ name: 'cover_image', length: 512, nullable: true })
  coverImage: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Landlord, landlord => landlord.properties)
  @JoinColumn({ name: 'landlord_id' })
  landlord: Landlord;

  @OneToMany(() => Room, room => room.property)
  rooms: Room[];
}
