import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DeviceType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('user_devices')
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  fcm_token: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  device_type: DeviceType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device_model: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  operating_system: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  os_version: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_virtual: boolean | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
