import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PlatformKpi } from './entities/analytics-platform-kpi.entity';
import { MonthlyMetric } from './entities/analytics-monthly-metric.entity';
import { CategoryMetric } from './entities/analytics-category-metric.entity';
import { User } from '../users/entities/user.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { Voucher } from '../vouchers/entities/voucher.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformKpi,
      MonthlyMetric,
      CategoryMetric,
      User,
      BusinessProfile,
      Voucher,
      WalletTransaction,
      Referral,
    ]),
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
