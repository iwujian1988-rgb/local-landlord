import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveUtilityReadingItemDto {
  @IsNumber()
  @IsIn([0, 1])
  @Type(() => Number)
  utilityType: number;

  /** none | manual total | metered */
  @IsString()
  @IsIn(['none', 'manual', 'metered'])
  mode: 'none' | 'manual' | 'metered';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  previousReading?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentReading?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}

export class SaveUtilityReadingsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period: string;

  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SaveUtilityReadingItemDto)
  readings: SaveUtilityReadingItemDto[];
}
