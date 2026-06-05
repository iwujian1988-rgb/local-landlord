import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
