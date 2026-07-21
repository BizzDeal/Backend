import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VoucherStatus } from '../../../common/enums';
import { Offer } from '../../offers/entities/offer.entity';
import { User } from '../../users/entities/user.entity';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  voucher_code: string;

  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => BusinessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile;

  @Column({
    type: 'enum',
    enum: VoucherStatus,
    default: VoucherStatus.ISSUED,
  })
  status: VoucherStatus;

  @Column({ type: 'timestamptz' })
  issued_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  redeemed_at: Date | null;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'uuid', nullable: true })
  redeemed_by_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'redeemed_by_id' })
  redeemed_by: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
