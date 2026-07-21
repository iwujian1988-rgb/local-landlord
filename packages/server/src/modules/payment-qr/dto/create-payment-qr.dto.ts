import { IsString, IsOptional, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentQrDto {
  @IsOptional()
  @IsString()
  @IsIn(['wechat', 'alipay', 'bank'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @IsIn([0, 1, 2])
  @Type(() => Number)
  typeNum?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  payeeName?: string;

  @IsOptional()
  @IsString()
  payeeNote?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
