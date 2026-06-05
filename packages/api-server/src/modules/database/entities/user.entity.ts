import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId?: string;

  @Column({ name: 'org_role', type: 'varchar', length: 50, nullable: true })
  orgRole?: 'owner' | 'admin' | 'member';

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @Column({ name: 'last_login', type: 'timestamp with time zone', nullable: true })
  lastLogin?: Date;

  @ManyToOne('Organization', 'users', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization?: any;

  @OneToMany('Device', 'owner')
  devices!: any[];
}
