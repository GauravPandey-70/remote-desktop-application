import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyPasscodeDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @Length(6, 6, { message: 'Passcode must be exactly 6 characters' })
  passcode!: string;
}
