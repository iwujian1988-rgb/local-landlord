import { IsString, IsNumber, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePaymentQrDto {
  @IsOptional()
  @IsIn(['wechat', 'alipay', 'bank', 0, 1, 2])
  type?: string | number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  typeNum?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  payeeName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  payeeNote?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
