import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payment_settings')
export class PaymentSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  upi_id: string;

  @Column({ type: 'varchar', length: 255 })
  account_name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  registration_fee: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 255, default: 'Join BIZZ DEAL as Member' })
  card_title: string;

  @Column({ type: 'varchar', length: 255, default: 'MEMBER ONBOARDING' })
  card_subtitle: string;

  @Column({
    type: 'text',
    default:
      'Unlock premium networking, verified lead sharing, referral vouchers, and business growth analytics.',
  })
  benefits: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
