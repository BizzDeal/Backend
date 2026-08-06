import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BizzCoinWallet } from './bizz-coin-wallet.entity';
import { User } from '../../users/entities/user.entity';
import { BusinessProfile } from '../../businesses/entities/business-profile.entity';

export enum BizzCoinTransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

@Entity('bizz_coin_transactions')
export class BizzCoinTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bizz_coin_wallet_id: string;

  @ManyToOne(() => BizzCoinWallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bizz_coin_wallet_id' })
  bizz_coin_wallet: BizzCoinWallet;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @ManyToOne(() => BusinessProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessProfile | null;

  @Column({
    type: 'enum',
    enum: BizzCoinTransactionType,
    default: BizzCoinTransactionType.CREDIT,
  })
  type: BizzCoinTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
