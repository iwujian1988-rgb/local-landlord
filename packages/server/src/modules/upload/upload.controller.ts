import {
  Controller, Post, Body, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MulterError } = require('multer');

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', UploadService.getMulterOptions()))
  async uploadFile(@UploadedFile() file: any) {
    try {
      return await this.uploadService.formatUploadResponse(file);
    } catch (err: any) {
      if (err?.name === 'MulterError' || err instanceof MulterError) {
        throw new BadRequestException(`上传失败: ${err.message}`);
      }
      throw err;
    }
  }

  @Post('base64')
  async uploadBase64(@Body() body: { data: string; size?: number }) {
    if (!body.data) {
      throw new BadRequestException('缺少文件数据');
    }
    return this.uploadService.uploadBase64(body.data, body.size);
  }
}
