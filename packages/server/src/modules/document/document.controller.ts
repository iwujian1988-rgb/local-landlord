import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('rooms/:roomId/documents')
  async upload(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.upload(roomId, dto);
  }

  @Get('rooms/:roomId/documents')
  async findByRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('type') type?: number,
  ) {
    return this.documentService.findByRoom(roomId, type);
  }

  @Delete('documents/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.documentService.remove(id);
    return null;
  }

  // ========== 管理员合同管理 ==========

  @Get('admin/documents')
  @UseGuards(RolesGuard)
  @Roles(0)
  async findAdminDocuments(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('type') type?: number,
    @Query('roomId') roomId?: number,
  ) {
    return this.documentService.findAdminDocuments(
      page || 1,
      pageSize || 20,
      type !== undefined ? Number(type) : undefined,
      roomId ? Number(roomId) : undefined,
    );
  }

  @Post('admin/documents')
  @UseGuards(RolesGuard)
  @Roles(0)
  async createAdminDocument(@Body() body: any) {
    return this.documentService.createAdminDocument(body);
  }

  @Delete('admin/documents/:id')
  @UseGuards(RolesGuard)
  @Roles(0)
  async removeAdminDocument(@Param('id', ParseIntPipe) id: number) {
    await this.documentService.remove(id);
    return null;
  }
}
