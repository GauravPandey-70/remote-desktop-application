import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: any;

  @ManyToOne('Device', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device?: any;
}
