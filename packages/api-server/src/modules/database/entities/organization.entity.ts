import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: {
      maxSessionDurationMinutes: 480,
      allowUnattendedAccess: false,
      requirePasscode: true,
      passcodeExpiryMinutes: 10,
    },
  })
  settings!: {
    maxSessionDurationMinutes: number;
    allowUnattendedAccess: boolean;
    requirePasscode: boolean;
    passcodeExpiryMinutes: number;
  };

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @OneToMany('User', 'organization')
  users!: any[];

  @OneToMany('Device', 'organization')
  devices!: any[];
}
