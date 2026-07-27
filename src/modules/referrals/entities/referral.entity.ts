import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReferralType } from '../../../common/enums';
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

  @Column({ type: 'uuid' })
  to_member_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_member_id' })
  to_member: User;

  @Column({
    type: 'enum',
    enum: ReferralType,
    default: ReferralType.INSIDE,
  })
  referral_type: ReferralType;

  @Column({ type: 'boolean', default: false })
  told_to_call: boolean;

  @Column({ type: 'boolean', default: false })
  card_given: boolean;

  @Column({ type: 'varchar', length: 255 })
  contact_name: string;

  @Column({ type: 'varchar', length: 50 })
  contact_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  contact_address: string | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'int', default: 0, nullable: true })
  rating: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
