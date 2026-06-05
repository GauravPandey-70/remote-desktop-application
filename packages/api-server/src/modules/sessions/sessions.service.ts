import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionEvent, Device } from '../database/entities';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionEventDto } from './dto/session-event.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(SessionEvent)
    private readonly sessionEventRepository: Repository<SessionEvent>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async createSession(dto: CreateSessionDto, initiatedById?: string): Promise<Session> {
    const host = await this.deviceRepository.findOne({ where: { deviceId: dto.hostDeviceId } });
    const client = await this.deviceRepository.findOne({ where: { deviceId: dto.clientDeviceId } });

    if (!host || !client) {
      throw new NotFoundException('Host or Client device not found');
    }

    const session = this.sessionRepository.create({
      hostDeviceId: host.id,
      clientDeviceId: client.id,
      initiatedBy: initiatedById,
      connectionType: dto.connectionType ?? 'p2p',
      status: 'connecting',
    });

    const savedSession = await this.sessionRepository.save(session);

    // Log initial event
    await this.logEvent(savedSession.id, {
      eventType: 'connecting',
      payload: { clientIp: client.lastIp, hostIp: host.lastIp },
    });

    return savedSession;
  }

  async updateSession(sessionId: string, dto: UpdateSessionDto): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (dto.status) {
      session.status = dto.status;
      if (dto.status === 'disconnected' || dto.status === 'failed') {
        session.endedAt = new Date();
        const durationMs = session.endedAt.getTime() - session.startedAt.getTime();
        session.durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
      }
    }

    if (dto.connectionType) {
      session.connectionType = dto.connectionType;
    }

    if (dto.qualityMetrics) {
      session.qualityMetrics = dto.qualityMetrics;
    }

    const updatedSession = await this.sessionRepository.save(session);

    // Log state change event
    if (dto.status) {
      await this.logEvent(sessionId, {
        eventType: dto.status as any,
        payload: dto.qualityMetrics,
      });
    }

    return updatedSession;
  }

  async logEvent(sessionId: string, dto: SessionEventDto): Promise<SessionEvent> {
    const event = this.sessionEventRepository.create({
      sessionId,
      eventType: dto.eventType,
      payload: dto.payload ?? {},
    });
    return this.sessionEventRepository.save(event);
  }

  async getSessionWithEvents(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['events', 'hostDevice', 'clientDevice'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async getSessionHistory(userId: string): Promise<Session[]> {
    // Return sessions initiated by this user or involving their devices
    return this.sessionRepository.find({
      where: [
        { initiatedBy: userId },
      ],
      relations: ['hostDevice', 'clientDevice'],
      order: { startedAt: 'DESC' },
    });
  }
}
