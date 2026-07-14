import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analytics_platform_kpis')
export class PlatformKpi {
  @PrimaryColumn({ type: 'varchar', length: 50, default: 'PLATFORM_SUMMARY' })
  id: string;

  @Column({ type: 'int', default: 0 })
  total_members: number;

  @Column({ type: 'int', default: 0 })
  active_members: number;

  @Column({ type: 'int', default: 0 })
  total_customers: number;

  @Column({ type: 'int', default: 0 })
  total_businesses: number;

  @Column({ type: 'int', default: 0 })
  total_vouchers_issued: number;

  @Column({ type: 'int', default: 0 })
  total_vouchers_redeemed: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_revenue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total_wallet_volume: number;

  @Column({ type: 'int', default: 0 })
  total_referrals: number;

  @Column({ type: 'int', default: 0 })
  converted_referrals: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
