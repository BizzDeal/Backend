import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OfferType, DiscountType, OfferStatus } from '../../../common/enums';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';
import { MediaFile } from '../../media/entities/media-file.entity';
import { User } from '../../users/entities/user.entity';

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: OfferType,
  })
  offer_type: OfferType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discount_value: number | null;

  @Column({
    type: 'enum',
    enum: DiscountType,
    nullable: true,
  })
  discount_type: DiscountType | null;

  @Column({ type: 'timestamptz' })
  start_date: Date;

  @Column({ type: 'timestamptz' })
  end_date: Date;

  @Column({ type: 'uuid', nullable: true })
  image_id: string | null;

  @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_id' })
  image: MediaFile | null;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

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
