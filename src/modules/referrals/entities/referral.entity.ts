import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReferralStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrer_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ type: 'varchar', length: 50 })
  referred_phone: string;

  @Column({ type: 'uuid', nullable: true })
  referred_user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referred_user_id' })
  referred_user: User | null;

  @Column({ type: 'varchar', length: 100 })
  referral_code: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reward_amount: number;

  @Column({ type: 'timestamptz', nullable: true })
  rewarded_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
