import { Injectable, BadRequestException } from '@nestjs/common';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer');

const allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class UploadService {
  static getMulterOptions() {
    return {
      storage: UploadService.getDiskStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: UploadService.fileFilter,
    };
  }

  private static getDiskStorage() {
    return multer.diskStorage({
      destination: (_req: any, _file: any, cb: any) => {
        const uploadDir = join(process.cwd(), 'uploads');
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (_req: any, file: any, cb: any) => {
        const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    });
  }

  private static fileFilter(_req: any, file: any, cb: any) {
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new BadRequestException('不支持的文件类型'), false);
      return;
    }
    cb(null, true);
  }

  getFileUrl(filename: string): string {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${baseUrl}/uploads/${filename}`;
  }

  formatUploadResponse(file: any) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: this.getFileUrl(file.filename),
    };
  }
}
