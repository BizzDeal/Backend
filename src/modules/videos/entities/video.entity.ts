import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VideoType, VideoCategory, VideoStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';
import { Offer } from '../../offers/entities/offer.entity';

@Entity('member_videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @ManyToOne(() => BusinessProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  offer_id: string | null;

  @ManyToOne(() => Offer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'varchar', length: 1000 })
  video_url: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  thumbnail_url: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: VideoType,
    default: VideoType.LANDSCAPE,
  })
  video_type: VideoType;

  @Index()
  @Column({
    type: 'enum',
    enum: VideoCategory,
    default: VideoCategory.GENERAL,
  })
  category: VideoCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cta_title: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  cta_url: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.ACTIVE,
  })
  status: VideoStatus;

  @Column({ type: 'integer', default: 0 })
  views_count: number;

  @Column({ type: 'integer', default: 0 })
  likes_count: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
