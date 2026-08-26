import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 30 })
  mega_deals_percent_threshold: number;

  @Column({ type: 'int', default: 500 })
  mega_deals_fixed_threshold: number;

  @Column({ type: 'int', default: 20 })
  home_feed_limit: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.00 })
  bizz_coin_value: number;

  @Column({ type: 'int', default: 100 })
  customer_signup_bizz_points: number;

  @Column({ type: 'int', default: 75 })
  customer_redemption_reward_bizz_points: number;

  @Column({ type: 'int', default: 100 })
  member_referral_bizz_points: number;

  @Column({ type: 'int', default: 50 })
  app_share_sharer_bizz_points: number;

  @Column({ type: 'int', default: 50 })
  app_share_joiner_bizz_points: number;

  @Column({ type: 'varchar', length: 255, default: 'https://play.google.com/store/apps/details?id=com.bizzdeal.app' })
  app_invite_base_url: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
