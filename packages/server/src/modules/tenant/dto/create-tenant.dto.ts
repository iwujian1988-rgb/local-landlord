import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsDateString, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const PAYMENT_METHODS = ['cash', 'wechat', 'alipay', 'bank'] as const;

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

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
  @IsNumber()
  @Type(() => Number)
  status?: number;

  // ====== P0-A: 入住实收 ======
  /** 收款方式：cash / wechat / alipay / bank。空 = 未记录实收。 */
  @IsOptional()
  @IsString()
  @IsIn([...PAYMENT_METHODS])
  initialPaymentMethod?: string;

  /** 实收日期 YYYY-MM */
  @IsOptional()
  @IsDateString()
  initialPaymentDate?: string;

  /** 实收金额（首期房租，不含押金） */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  initialPaymentAmount?: number;

  /** 入住水电读数 */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  moveInReading?: string;
}
