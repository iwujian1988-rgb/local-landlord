import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

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

  /** 文档列表（按 room_id + type 筛选） */
  async findByRoom(roomId: number, type?: number): Promise<Document[]> {
    const where: any = { roomId };
    if (type !== undefined) {
      where.type = type;
    }
    return this.documentRepository.find({
      where,
      order: { uploadedAt: 'DESC' },
    });
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
