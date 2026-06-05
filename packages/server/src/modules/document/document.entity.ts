import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from '../room/room.entity';

@Entity('document')
export class Document {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'room_id', type: 'bigint', unsigned: true })
  roomId: number;

  @Column({ type: 'tinyint', unsigned: true })
  type: number;

  @Column({ length: 64 })
  name: string;

  @Column({ name: 'image_url', length: 512 })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @ManyToOne(() => Room, room => room.documents)
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
