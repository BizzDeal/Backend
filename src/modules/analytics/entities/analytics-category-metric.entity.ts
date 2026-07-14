import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('analytics_category_metrics')
export class CategoryMetric {
  @PrimaryColumn({ type: 'uuid' })
  category_id: string;

  @Column({ type: 'varchar', length: 255 })
  category_name: string;

  @Column({ type: 'int', default: 0 })
  business_count: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
