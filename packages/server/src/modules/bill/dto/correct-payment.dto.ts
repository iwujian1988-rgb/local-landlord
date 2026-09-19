import { IsNumber, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CorrectPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  paidAmount: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  expectedPaidAmount: number;
  @IsString() @MaxLength(256)
  reason: string;
}
