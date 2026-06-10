import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RemindTenantDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tenantId?: number;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
