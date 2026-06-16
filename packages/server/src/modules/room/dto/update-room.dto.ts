import { IsString, IsNumber, IsOptional, IsArray, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  @Type(() => Number)
  rent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  status?: number;

  @IsOptional()
  @IsString()
  availableDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  orientation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  action?: string;

  // Deposit refund fields — only used when action='checkout'
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  depositStatus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  depositRefundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  depositDeductReason?: string;

  // P0-B/C: 退租水电读数 + 预付租金退还（前端可传，否则后端自动算）
  @IsOptional()
  @IsString()
  @MaxLength(256)
  moveOutReading?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prepaidRefundAmount?: number;
}
