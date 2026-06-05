import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 20, unique: true })
  deviceId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'os_type', type: 'varchar', length: 10 })
  osType!: 'windows' | 'macos';

  @Column({ name: 'os_version', type: 'varchar', length: 100 })
  osVersion!: string;

  @Column({ name: 'agent_version', type: 'varchar', length: 50 })
  agentVersion!: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey!: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId?: string;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId?: string;

  @Column({ name: 'last_ip', type: 'varchar', length: 45, nullable: true }) // length 45 supports IPv6
  lastIp?: string;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline!: boolean;

  @UpdateDateColumn({ name: 'last_seen', type: 'timestamp with time zone' })
  lastSeen!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne('User', 'devices', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner?: any;

  @ManyToOne('Organization', 'devices', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization?: any;

  @OneToMany('Passcode', 'device')
  passcodes!: any[];

  @OneToMany('Session', 'hostDevice')
  hostSessions!: any[];

  @OneToMany('Session', 'clientDevice')
  clientSessions!: any[];
}
