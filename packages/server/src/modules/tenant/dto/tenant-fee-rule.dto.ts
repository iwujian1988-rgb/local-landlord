import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TenantFeeRuleDto {
  @IsString()
  @MaxLength(32)
  name: string;

  @IsIn(['fixed', 'manual', 0, 1])
  type: 'fixed' | 'manual' | 0 | 1;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isRent?: boolean;

  @IsOptional()
  @IsIn(['rent', 'monthly'])
  cycleMode?: 'rent' | 'monthly';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  billingMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  initialMonths?: number;
}
