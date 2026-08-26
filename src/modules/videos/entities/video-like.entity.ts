import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from './video.entity';

@Entity('video_likes')
@Unique(['user_id', 'video_id'])
export class VideoLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  video_id: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
