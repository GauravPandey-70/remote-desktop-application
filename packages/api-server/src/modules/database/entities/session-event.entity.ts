import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('session_events')
export class SessionEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: 'connecting' | 'connected' | 'ice_restart' | 'quality_change' | 'reconnecting' | 'disconnected' | 'error';

  @Column({ type: 'jsonb', nullable: true, default: {} })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne('Session', 'events', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: any;
}
