import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { Document } from './document.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Room, Property])],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
