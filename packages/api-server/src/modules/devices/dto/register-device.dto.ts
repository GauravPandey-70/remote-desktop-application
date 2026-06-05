import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['windows', 'macos'])
  osType!: 'windows' | 'macos';

  @IsString()
  @IsNotEmpty()
  osVersion!: string;

  @IsString()
  @IsNotEmpty()
  agentVersion!: string;

  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
