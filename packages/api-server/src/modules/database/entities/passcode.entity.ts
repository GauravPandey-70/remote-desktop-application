import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('passcodes')
export class Passcode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ type: 'varchar', length: 255 })
  hash!: string;

  @Column({ type: 'varchar', length: 255 })
  salt!: string;

  @Column({ type: 'smallint', default: 0 })
  attempts!: number;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne('Device', 'passcodes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: any;
}
