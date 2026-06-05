import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../database/entities';

@Injectable()
export class DiagnosticsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async analyzeSession(sessionId: string): Promise<{
    status: string;
    metrics: any;
    analysis: string;
    suggestions: string[];
  }> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['events'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const metrics = session.qualityMetrics || {
      fps: 30,
      bitrate: 2.0,
      latencyMs: 35,
      packetLoss: 0.0,
    };

    let analysis = 'Connection quality is healthy and stable.';
    const suggestions: string[] = [];

    // Rule 1: Latency checks
    if (metrics.latencyMs > 200) {
      analysis = 'High connection latency detected.';
      suggestions.push('High network delay (>200ms). We suggest switching from Wi-Fi to a wired Ethernet connection.');
      suggestions.push('Lower the screen sharing resolution to 720p inside client settings to minimize frame delay.');
    }

    // Rule 2: Packet Loss and Relay
    if (metrics.packetLoss > 0.03) {
      analysis = 'Heavy network packet loss detected.';
      suggestions.push('Significant packet drop. Your local network or ISP is experiencing congestion.');
      if (session.connectionType !== 'turn_relayed') {
        suggestions.push('Try forcing a TURN relay connection (relayed UDP/TCP) to bypass NAT/firewall throttling.');
      }
    }

    // Rule 3: Low FPS
    if (metrics.fps && metrics.fps < 15) {
      analysis = 'Choppy display stream (low frame rate).';
      suggestions.push('Host computer CPU/GPU is heavily utilized. Try closing resource-intensive tasks on the host.');
    }

    // Rule 4: Empty events or fail states
    if (session.status === 'failed') {
      analysis = 'The connection failed during setup.';
      suggestions.push('The host agent did not confirm the handshake. Verify the host is online and running.');
    }

    if (suggestions.length === 0) {
      suggestions.push('No issues detected. Keep using the optimal direct P2P connection.');
    }

    return {
      status: session.status,
      metrics,
      analysis,
      suggestions,
    };
  }
}
