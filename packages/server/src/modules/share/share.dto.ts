import { IsOptional, IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateShareDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  billId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  singleChargeId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @IsString()
  period?: string;
}
