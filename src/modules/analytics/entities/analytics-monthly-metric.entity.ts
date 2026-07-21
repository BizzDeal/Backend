import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analytics_monthly_metrics')
export class MonthlyMetric {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  period_month: string; // e.g. '2026-07'

  @Column({ type: 'int', default: 0 })
  new_customers: number;

  @Column({ type: 'int', default: 0 })
  new_members: number;

  @Column({ type: 'int', default: 0 })
  vouchers_issued: number;

  @Column({ type: 'int', default: 0 })
  vouchers_redeemed: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  wallet_credits: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  wallet_debits: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  revenue: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
