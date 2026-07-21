import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MeetingStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  created_by_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @ManyToOne(() => BusinessProfile, (business) => business.id, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz' })
  meeting_date: Date;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  meeting_link: string | null;

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    default: MeetingStatus.SCHEDULED,
  })
  status: MeetingStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
