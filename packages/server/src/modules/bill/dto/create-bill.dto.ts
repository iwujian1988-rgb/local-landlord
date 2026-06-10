import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class BillItemInput {
  @IsOptional()
  @IsString()
  feeName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}

export class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  period: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemInput)
  items: BillItemInput[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tenantId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount?: number;
}
