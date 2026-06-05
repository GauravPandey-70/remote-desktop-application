import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { DevicesModule } from '../devices/devices.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [DevicesModule, SessionsModule],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class GatewayModule {}
