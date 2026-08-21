import { IsOptional, IsNumber, IsString, IsNotEmpty, IsIn } from 'class-validator';
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

export class MarkShareSentDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ReceiptPromptDto {
  @IsIn(['bill', 'single_charge'])
  kind: 'bill' | 'single_charge';

  @IsNumber()
  @Type(() => Number)
  id: number;
}
