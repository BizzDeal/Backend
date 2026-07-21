import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BusinessStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { BusinessCategory } from './business-category.entity';
import { MediaFile } from '../../media/entities/media-file.entity';
import { State } from '../../location/entities/state.entity';
import { District } from '../../location/entities/district.entity';

@Entity('business_profiles')
export class BusinessProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @OneToOne(() => User, (user) => user.business_profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => BusinessCategory)
  @JoinColumn({ name: 'category_id' })
  category: BusinessCategory;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gst_number: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'uuid', nullable: true })
  state_id: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'state_id' })
  state: State | null;

  @Column({ type: 'uuid', nullable: true })
  district_id: string | null;

  @ManyToOne(() => District, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'district_id' })
  district: District | null;

  @Column({ type: 'uuid', nullable: true })
  logo_id: string | null;

  @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'logo_id' })
  logo: MediaFile | null;

  @Column({
    type: 'enum',
    enum: BusinessStatus,
    default: BusinessStatus.PENDING,
  })
  status: BusinessStatus;

  @Column({ type: 'boolean', default: false })
  is_featured: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
