import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResolvePasscodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Passcode must be exactly 6 characters' })
  passcode!: string;
}
