import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  hostDeviceId!: string;

  @IsString()
  @IsNotEmpty()
  clientDeviceId!: string;

  @IsString()
  @IsOptional()
  connectionType?: 'p2p' | 'turn_relayed';
}
