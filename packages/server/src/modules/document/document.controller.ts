import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  private parseOptionalInt(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  @Post('rooms/:roomId/documents')
  async upload(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() dto: UploadDocumentDto,
  ) {
    await this.documentService.verifyRoomOwnership(roomId, user.id);
    return this.documentService.upload(roomId, dto);
  }

  @Get('rooms/:roomId/documents')
  async findByRoom(
    @CurrentUser() user: any,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query('type') type?: string,
  ) {
    await this.documentService.verifyRoomOwnership(roomId, user.id);
    return this.documentService.findByRoom(roomId, this.parseOptionalInt(type));
  }

  @Delete('documents/:id')
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.documentService.verifyDocumentOwnership(id, user.id);
    await this.documentService.remove(id);
    return null;
  }

  // ========== 管理员合同管理 ==========

  @Get('admin/documents')
  @UseGuards(RolesGuard)
  @Roles(0)
  async findAdminDocuments(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('roomId') roomId?: string,
  ) {
    const parsedPage = this.parseOptionalInt(page) || 1;
    const parsedPageSize = this.parseOptionalInt(pageSize) || 20;
    return this.documentService.findAdminDocuments(
      parsedPage,
      parsedPageSize,
      this.parseOptionalInt(type),
      this.parseOptionalInt(roomId),
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
