import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn({ length: 64 })
  key: string;

  @Column({ type: 'json', nullable: true })
  value: any;

  @UpdateDateColumn()
  updatedAt: Date;
}
