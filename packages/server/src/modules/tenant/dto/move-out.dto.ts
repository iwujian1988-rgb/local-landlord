import { IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveOutDto {
  @IsOptional()
  @IsString()
  moveOutDate?: string;

  /** 0: 未处理, 1: 已退还 */
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

  /** P0-C: 退租水电读数 */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  moveOutReading?: string;

  /** P0-B: 后端会自动算应退预付租金；前端如果传了，以此为准（兼容人工调整） */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prepaidRefundAmount?: number;
}
