import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DevicesModule } from './modules/devices/devices.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    DevicesModule,
    SessionsModule,
    GatewayModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

