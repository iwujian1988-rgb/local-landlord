import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('admin')
export class Admin {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Index({ unique: true })
  @Column({ length: 32, unique: true })
  username: string;

  @Column({ length: 256 })
  password: string;

  @Column({ length: 32 })
  name: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  role: number;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  status: number;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
