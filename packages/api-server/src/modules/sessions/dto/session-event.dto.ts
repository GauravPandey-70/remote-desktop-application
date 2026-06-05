import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class SessionEventDto {
  @IsEnum(['connecting', 'connected', 'ice_restart', 'quality_change', 'reconnecting', 'disconnected', 'error'])
  eventType!: 'connecting' | 'connected' | 'ice_restart' | 'quality_change' | 'reconnecting' | 'disconnected' | 'error';

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
