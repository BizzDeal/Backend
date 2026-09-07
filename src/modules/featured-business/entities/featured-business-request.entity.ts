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
import { FeaturedRequestStatus } from '../../../common/enums';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';
import { BusinessCategory } from '../../businesses/entities/business-category.entity';
import { MediaFile } from '../../media/entities/media-file.entity';
import { User } from '../../users/entities/user.entity';

@Entity('featured_business_requests')
@Index(['category_id', 'status'])
export class FeaturedBusinessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile;

  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => BusinessCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: BusinessCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  banner_id: string | null;

  @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'banner_id' })
  banner: MediaFile | null;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({
    type: 'enum',
    enum: FeaturedRequestStatus,
    default: FeaturedRequestStatus.PENDING,
  })
  status: FeaturedRequestStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by_id' })
  approved_by: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
