import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadMode: string;
  private readonly cosBucket: string;
  private readonly cosRegion: string;

  constructor() {
    this.uploadMode = process.env.UPLOAD_MODE || 'local';
    this.cosBucket = process.env.COS_BUCKET || '';
    this.cosRegion = process.env.COS_REGION || '';
  }

  static getMulterOptions() {
    const uploadMode = process.env.UPLOAD_MODE || 'local';

    if (uploadMode === 'cloudbase') {
      return {
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: UploadService.fileFilter,
      };
    }

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
    if (this.uploadMode === 'cloudbase' && this.cosBucket && this.cosRegion) {
      return `https://${this.cosBucket}.cos.${this.cosRegion}.myqcloud.com/${filename}`;
    }
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${baseUrl}/uploads/${filename}`;
  }

  async uploadToCos(file: any): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const COS = require('cos-nodejs-sdk-v5');
    const cos = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY,
    });

    const filename = `${uuidv4()}${extname(file.originalname)}`;
    const key = `uploads/${filename}`;

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: this.cosBucket,
          Region: this.cosRegion,
          Key: key,
          Body: file.buffer,
          ContentLength: file.size,
        },
        (err: Error | null, _data: any) => {
          if (err) {
            this.logger.error('COS upload failed', err);
            reject(new BadRequestException('文件上传到云存储失败'));
            return;
          }
          resolve(filename);
        },
      );
    });
  }

  async formatUploadResponse(file: any) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    if (this.uploadMode === 'cloudbase') {
      const filename = await this.uploadToCos(file);
      return {
        filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: this.getFileUrl(filename),
      };
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
