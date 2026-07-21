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

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
