import { Controller, Post, Patch, Get, Body, Param, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { DiagnosticsService } from './diagnostics.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionEventDto } from './dto/session-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly diagnosticsService: DiagnosticsService,
  ) {}

  @Post()
  async createSession(@Body(new ValidationPipe()) dto: CreateSessionDto, @Req() req: any) {
    // Session can be initiated anonymously or by logged-in user
    const userId = req.user?.id;
    return this.sessionsService.createSession(dto, userId);
  }

  @Patch(':id')
  async updateSession(
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdateSessionDto,
  ) {
    return this.sessionsService.updateSession(id, dto);
  }

  @Post(':id/events')
  async logEvent(
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: SessionEventDto,
  ) {
    return this.sessionsService.logEvent(id, dto);
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.sessionsService.getSessionWithEvents(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getSessionHistory(@Req() req: any) {
    return this.sessionsService.getSessionHistory(req.user.id);
  }

  @Get(':id/diagnostics')
  async getSessionDiagnostics(@Param('id') id: string) {
    return this.diagnosticsService.analyzeSession(id);
  }
}
