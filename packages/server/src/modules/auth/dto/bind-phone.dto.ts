import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BindPhoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  phoneCode: string;
}
