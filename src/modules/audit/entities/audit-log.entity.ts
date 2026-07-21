import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  action: string;

  @Column({ type: 'varchar', length: 255 })
  entity_type: string;

  @Column({ type: 'uuid', nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  old_data: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_data: Record<string, any> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
