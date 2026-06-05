import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsDateString()
  moveInDate: string;

  @IsDateString()
  contractEndDate: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  rentDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
