import { IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmPaymentDto {
  @IsOptional()
  @IsString()
  paymentNote?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualAmount?: number;
}
