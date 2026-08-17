import { IsString, IsNumber, IsOptional, Min, Max, IsDateString, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantFeeRuleDto } from './tenant-fee-rule.dto';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsDateString()
  moveInDate?: string;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  @Type(() => Number)
  rentDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  payMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  moveInReading?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantFeeRuleDto)
  feeItems?: TenantFeeRuleDto[];
}
