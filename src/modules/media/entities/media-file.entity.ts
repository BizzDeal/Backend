import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MediaType, MediaPurpose } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('media_files')
export class MediaFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploaded_by: User | null;

  @Column({ type: 'text' })
  file_url: string;

  @Column({ type: 'varchar', length: 255 })
  public_id: string;

  @Column({
    type: 'enum',
    enum: MediaType,
  })
  file_type: MediaType;

  @Column({
    type: 'enum',
    enum: MediaPurpose,
    default: MediaPurpose.GENERAL,
  })
  purpose: MediaPurpose;

  @Column({ type: 'varchar', length: 100 })
  mime_type: string;

  @Column({ type: 'integer' })
  file_size: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
