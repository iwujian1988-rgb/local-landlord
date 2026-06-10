import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { Room } from '../room/room.entity';
import { Property } from '../property/property.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';

const DOC_TYPE_MAP: Record<number, string> = {
  0: 'contract', 1: 'receipt', 2: 'utility', 3: 'repair', 4: 'deposit', 5: 'other',
};

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  /** Verify room belongs to landlord */
  async verifyRoomOwnership(roomId: number, landlordId: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('房间不存在');
    const property = await this.propertyRepository.findOne({ where: { id: room.propertyId } });
    if (!property || property.landlordId !== landlordId) {
      throw new ForbiddenException('无权访问该房间');
    }
  }

  /** Verify document belongs to landlord (via room -> property chain) */
  async verifyDocumentOwnership(documentId: number, landlordId: number): Promise<void> {
    const doc = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('文档不存在');
    await this.verifyRoomOwnership(doc.roomId, landlordId);
  }

  /** 上传文档（合同/收据/其他） */
  async upload(roomId: number, dto: UploadDocumentDto): Promise<Document> {
    const doc = this.documentRepository.create({
      roomId,
      type: dto.type,
      name: dto.name,
      imageUrl: dto.imageUrl,
      note: dto.note || '',
    });
    return this.documentRepository.save(doc);
  }

  /** 文档列表 (API contract shape with type as string) */
  async findByRoom(roomId: number, type?: number) {
    const where: any = { roomId };
    if (type !== undefined) {
      where.type = type;
    }
    const docs = await this.documentRepository.find({
      where,
      order: { uploadedAt: 'DESC' },
    });
    return docs.map(d => ({
      id: d.id,
      type: DOC_TYPE_MAP[d.type] || 'other',
      name: d.name,
      imageUrl: d.imageUrl,
      note: d.note || '',
      date: d.uploadedAt ? d.uploadedAt.toISOString().slice(0, 10) : '',
    }));
  }

  /** 删除文档 */
  async remove(id: number): Promise<void> {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('文档不存在');
    await this.documentRepository.remove(doc);
  }

  // ========== 管理员合同管理 ==========

  async findAdminDocuments(
    page: number,
    pageSize: number,
    type?: number,
    roomId?: number,
  ) {
    const qb = this.documentRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.room', 'room');

    if (type !== undefined && type !== null) {
      qb.andWhere('doc.type = :type', { type });
    }
    if (roomId) {
      qb.andWhere('doc.roomId = :roomId', { roomId });
    }

    qb.skip((page - 1) * pageSize).take(pageSize).orderBy('doc.uploadedAt', 'DESC');
    const [list, total] = await qb.getManyAndCount();
    return { list, total, page, pageSize };
  }

  async createAdminDocument(data: {
    roomId: number;
    type: number;
    name: string;
    imageUrl: string;
    note?: string;
  }) {
    const doc = this.documentRepository.create({
      roomId: data.roomId,
      type: data.type,
      name: data.name,
      imageUrl: data.imageUrl,
      note: data.note || '',
    });
    return this.documentRepository.save(doc);
  }
}
