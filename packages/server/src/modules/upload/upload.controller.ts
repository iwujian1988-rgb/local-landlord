import {
  Controller, Post, UseInterceptors, UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', UploadService.getMulterOptions()))
  async uploadFile(@UploadedFile() file: any) {
    return this.uploadService.formatUploadResponse(file);
  }
}
