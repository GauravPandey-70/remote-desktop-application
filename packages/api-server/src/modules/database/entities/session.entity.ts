import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'host_device_id', type: 'uuid' })
  hostDeviceId!: string;

  @Column({ name: 'client_device_id', type: 'uuid' })
  clientDeviceId!: string;

  @Column({ name: 'initiated_by', type: 'uuid', nullable: true })
  initiatedBy?: string;

  @Column({ name: 'connection_type', type: 'varchar', length: 20, nullable: true })
  connectionType?: 'p2p' | 'turn_relayed';

  @Column({ name: 'host_ip', type: 'varchar', length: 45, nullable: true })
  hostIp?: string;

  @Column({ name: 'client_ip', type: 'varchar', length: 45, nullable: true })
  clientIp?: string;

  @Column({ type: 'varchar', length: 20, default: 'connecting' })
  status!: 'connecting' | 'active' | 'disconnected' | 'failed';

  @Column({
    name: 'quality_metrics',
    type: 'jsonb',
    nullable: true,
  })
  qualityMetrics?: {
    fps: number;
    bitrate: number;
    latencyMs: number;
    packetLoss: number;
    resolution: { width: number; height: number };
    codec: string;
  };

  @CreateDateColumn({ name: 'started_at', type: 'timestamp with time zone' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamp with time zone', nullable: true })
  endedAt?: Date;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds?: number;

  @ManyToOne('Device', 'hostSessions')
  @JoinColumn({ name: 'host_device_id' })
  hostDevice!: any;

  @ManyToOne('Device', 'clientSessions')
  @JoinColumn({ name: 'client_device_id' })
  clientDevice!: any;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiator?: any;

  @OneToMany('SessionEvent', 'session')
  events!: any[];
}
