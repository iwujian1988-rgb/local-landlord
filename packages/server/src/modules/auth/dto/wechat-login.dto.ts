import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

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

  /** One-time code returned by the miniapp getPhoneNumber button. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  phoneCode?: string;
}
