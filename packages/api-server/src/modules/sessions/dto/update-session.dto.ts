import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateSessionDto {
  @IsEnum(['connecting', 'active', 'disconnected', 'failed'])
  @IsOptional()
  status?: 'connecting' | 'active' | 'disconnected' | 'failed';

  @IsString()
  @IsOptional()
  connectionType?: 'p2p' | 'turn_relayed';

  @IsObject()
  @IsOptional()
  qualityMetrics?: {
    fps: number;
    bitrate: number;
    latencyMs: number;
    packetLoss: number;
    resolution: { width: number; height: number };
    codec: string;
  };
}
