import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RemindTenantDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
