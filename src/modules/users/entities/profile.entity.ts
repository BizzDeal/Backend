import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { State } from '../../location/entities/state.entity';
import { District } from '../../location/entities/district.entity';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  full_name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  whatsapp: string | null;

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
  primary_business_id: string | null;

  @ManyToOne(() => BusinessProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_business_id' })
  primary_business: BusinessProfile | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
