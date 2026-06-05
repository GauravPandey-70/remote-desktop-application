import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session, SessionEvent, Device } from '../database/entities';
import { SessionsService } from './sessions.service';
import { DiagnosticsService } from './diagnostics.service';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Session, SessionEvent, Device])],
  providers: [SessionsService, DiagnosticsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
