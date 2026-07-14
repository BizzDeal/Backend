import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformKpi } from './entities/analytics-platform-kpi.entity';
import { MonthlyMetric } from './entities/analytics-monthly-metric.entity';
import { CategoryMetric } from './entities/analytics-category-metric.entity';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Voucher } from '../vouchers/entities/voucher.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { Referral } from '../referrals/entities/referral.entity';
import {
  UserRole,
  UserStatus,
  VoucherStatus,
  WalletTransactionType,
  ReferralStatus,
} from '../../common/enums';
import {
  AdminAnalyticsOverviewDto,
  DetailedAnalyticsDto,
} from './schemas/analytics.schema';

@Injectable()
export class AnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(PlatformKpi)
    private readonly kpiRepo: Repository<PlatformKpi>,
    @InjectRepository(MonthlyMetric)
    private readonly monthlyRepo: Repository<MonthlyMetric>,
    @InjectRepository(CategoryMetric)
    private readonly categoryRepo: Repository<CategoryMetric>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
  ) {}

  async onModuleInit() {
    try {
      await this.syncExistingData();
    } catch (error: any) {
      this.logger.error('Failed to sync analytics data on startup:', error.message);
    }
  }

  private getCurrentMonthKey(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private async getOrCreatePlatformKpi(): Promise<PlatformKpi> {
    let kpi = await this.kpiRepo.findOne({
      where: { id: 'PLATFORM_SUMMARY' },
    });
    if (!kpi) {
      kpi = this.kpiRepo.create({
        id: 'PLATFORM_SUMMARY',
        total_members: 0,
        active_members: 0,
        total_customers: 0,
        total_businesses: 0,
        total_vouchers_issued: 0,
        total_vouchers_redeemed: 0,
        total_revenue: 0,
        total_wallet_volume: 0,
        total_referrals: 0,
        converted_referrals: 0,
      });
      await this.kpiRepo.save(kpi);
    }
    return kpi;
  }

  private async getOrCreateMonthlyMetric(period_month?: string): Promise<MonthlyMetric> {
    const month = period_month || this.getCurrentMonthKey();
    let metric = await this.monthlyRepo.findOne({
      where: { period_month: month },
    });
    if (!metric) {
      metric = this.monthlyRepo.create({
        period_month: month,
        new_customers: 0,
        new_members: 0,
        vouchers_issued: 0,
        vouchers_redeemed: 0,
        wallet_credits: 0,
        wallet_debits: 0,
        revenue: 0,
      });
      await this.monthlyRepo.save(metric);
    }
    return metric;
  }

  // --- O(1) Instant Read Methods ---

  async getOverviewAnalytics(): Promise<{ success: boolean; data: AdminAnalyticsOverviewDto }> {
    const kpi = await this.getOrCreatePlatformKpi();
    const recentMonths = await this.monthlyRepo.find({
      order: { period_month: 'ASC' },
      take: 7,
    });

    const dates = recentMonths.map((m) => m.period_month);
    const amounts = recentMonths.map((m) => Number(m.revenue || 0));

    // Ensure we have at least current month if history is empty
    if (dates.length === 0) {
      dates.push(this.getCurrentMonthKey());
      amounts.push(0);
    }

    const data: AdminAnalyticsOverviewDto = {
      totalMembers: kpi.total_members,
      activeMembers: kpi.active_members,
      totalCustomers: kpi.total_customers,
      totalVouchers: kpi.total_vouchers_redeemed,
      revenue: Number(kpi.total_revenue || 0),
      revenueHistory: {
        dates,
        amounts,
      },
    };

    return { success: true, data };
  }

  async getDetailedAnalytics(): Promise<{ success: boolean; data: DetailedAnalyticsDto }> {
    const kpi = await this.getOrCreatePlatformKpi();
    const recentMonths = await this.monthlyRepo.find({
      order: { period_month: 'ASC' },
      take: 7,
    });
    const categories = await this.categoryRepo.find({
      order: { business_count: 'DESC' },
    });

    const months = recentMonths.map((m) => m.period_month);
    const customers = recentMonths.map((m) => m.new_customers || 0);
    const members = recentMonths.map((m) => m.new_members || 0);
    const issued = recentMonths.map((m) => m.vouchers_issued || 0);
    const redeemed = recentMonths.map((m) => m.vouchers_redeemed || 0);
    const credits = recentMonths.map((m) => Number(m.wallet_credits || 0));
    const debits = recentMonths.map((m) => Number(m.wallet_debits || 0));

    // Ensure at least 1 period if empty
    if (months.length === 0) {
      const curr = this.getCurrentMonthKey();
      months.push(curr);
      customers.push(0);
      members.push(0);
      issued.push(0);
      redeemed.push(0);
      credits.push(0);
      debits.push(0);
    }

    const catNames = categories.map((c) => c.category_name);
    const catCounts = categories.map((c) => c.business_count || 0);

    const totalRef = kpi.total_referrals || 0;
    const convRef = kpi.converted_referrals || 0;
    const conversionRate = totalRef > 0 ? Number(((convRef / totalRef) * 100).toFixed(1)) : 0;

    const data: DetailedAnalyticsDto = {
      kpis: {
        totalUsers: kpi.total_members + kpi.total_customers,
        totalBusinesses: kpi.total_businesses,
        totalVouchersRedeemed: kpi.total_vouchers_redeemed,
        totalWalletVolume: Number(kpi.total_wallet_volume || 0),
      },
      userGrowth: {
        months,
        customers,
        members,
      },
      voucherPerformance: {
        months,
        issued,
        redeemed,
      },
      businessDistribution: {
        categories: catNames.length > 0 ? catNames : ['General'],
        counts: catCounts.length > 0 ? catCounts : [0],
      },
      walletVolume: {
        months,
        credits,
        debits,
      },
      referralStats: {
        total: totalRef,
        converted: convRef,
        conversionRate,
      },
    };

    return { success: true, data };
  }

  // --- On-the-Spot Tracker Methods ---

  async trackUserCreated(role: UserRole): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      const monthly = await this.getOrCreateMonthlyMetric();

      if (role === UserRole.CUSTOMER) {
        kpi.total_customers += 1;
        monthly.new_customers += 1;
      } else if (role === UserRole.MEMBER) {
        kpi.total_members += 1;
        monthly.new_members += 1;
      }

      await this.kpiRepo.save(kpi);
      await this.monthlyRepo.save(monthly);
    } catch (err: any) {
      this.logger.error('Error tracking user created:', err.message);
    }
  }

  async trackMemberApproved(): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      kpi.active_members += 1;
      await this.kpiRepo.save(kpi);
    } catch (err: any) {
      this.logger.error('Error tracking member approved:', err.message);
    }
  }

  async trackMemberRejectedOrSuspended(): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      if (kpi.active_members > 0) {
        kpi.active_members -= 1;
        await this.kpiRepo.save(kpi);
      }
    } catch (err: any) {
      this.logger.error('Error tracking member rejected/suspended:', err.message);
    }
  }

  async trackBusinessCreated(categoryId: string, categoryName: string): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      kpi.total_businesses += 1;
      await this.kpiRepo.save(kpi);

      if (categoryId) {
        let catMetric = await this.categoryRepo.findOne({
          where: { category_id: categoryId },
        });
        if (!catMetric) {
          catMetric = this.categoryRepo.create({
            category_id: categoryId,
            category_name: categoryName || 'Uncategorized',
            business_count: 1,
          });
        } else {
          catMetric.business_count += 1;
          if (categoryName) catMetric.category_name = categoryName;
        }
        await this.categoryRepo.save(catMetric);
      }
    } catch (err: any) {
      this.logger.error('Error tracking business created:', err.message);
    }
  }

  async trackVoucherIssued(): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      const monthly = await this.getOrCreateMonthlyMetric();

      kpi.total_vouchers_issued += 1;
      monthly.vouchers_issued += 1;

      await this.kpiRepo.save(kpi);
      await this.monthlyRepo.save(monthly);
    } catch (err: any) {
      this.logger.error('Error tracking voucher issued:', err.message);
    }
  }

  async trackVoucherRedeemed(value: number = 0): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      const monthly = await this.getOrCreateMonthlyMetric();

      kpi.total_vouchers_redeemed += 1;
      monthly.vouchers_redeemed += 1;

      if (value > 0) {
        kpi.total_revenue = Number(kpi.total_revenue || 0) + value;
        monthly.revenue = Number(monthly.revenue || 0) + value;
      }

      await this.kpiRepo.save(kpi);
      await this.monthlyRepo.save(monthly);
    } catch (err: any) {
      this.logger.error('Error tracking voucher redeemed:', err.message);
    }
  }

  async trackWalletTransaction(type: WalletTransactionType, amount: number): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      const monthly = await this.getOrCreateMonthlyMetric();

      const numAmount = Number(amount || 0);
      kpi.total_wallet_volume = Number(kpi.total_wallet_volume || 0) + numAmount;

      if (type === WalletTransactionType.CREDIT) {
        monthly.wallet_credits = Number(monthly.wallet_credits || 0) + numAmount;
      } else if (type === WalletTransactionType.DEBIT) {
        monthly.wallet_debits = Number(monthly.wallet_debits || 0) + numAmount;
      }

      await this.kpiRepo.save(kpi);
      await this.monthlyRepo.save(monthly);
    } catch (err: any) {
      this.logger.error('Error tracking wallet transaction:', err.message);
    }
  }

  async trackReferralCreated(): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      kpi.total_referrals += 1;
      await this.kpiRepo.save(kpi);
    } catch (err: any) {
      this.logger.error('Error tracking referral created:', err.message);
    }
  }

  async trackReferralConverted(): Promise<void> {
    try {
      const kpi = await this.getOrCreatePlatformKpi();
      kpi.converted_referrals += 1;
      await this.kpiRepo.save(kpi);
    } catch (err: any) {
      this.logger.error('Error tracking referral converted:', err.message);
    }
  }

  // --- Bootstrap Reconciliation & Sync ---

  async syncExistingData(): Promise<void> {
    this.logger.log('Starting analytics reconciliation check...');

    // 1. Check/Count from Users
    const totalMembers = await this.userRepo.count({ where: { role: UserRole.MEMBER } });
    const activeMembers = await this.userRepo.count({ where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE } });
    const totalCustomers = await this.userRepo.count({ where: { role: UserRole.CUSTOMER } });

    // 2. Count Businesses
    const totalBusinesses = await this.businessRepo.count();

    // 3. Count Vouchers
    const totalVouchersIssued = await this.voucherRepo.count();
    const totalVouchersRedeemed = await this.voucherRepo.count({ where: { status: VoucherStatus.REDEEMED } });

    // 4. Calculate total wallet volume & revenue from transactions
    const txs = await this.txRepo.find();
    let totalWalletVolume = 0;
    let totalRevenue = 0;
    for (const tx of txs) {
      const amt = Number(tx.amount || 0);
      totalWalletVolume += amt;
      if (tx.type === WalletTransactionType.CREDIT) {
        totalRevenue += amt;
      }
    }

    // 5. Count Referrals
    const totalReferrals = await this.referralRepo.count();
    const convertedReferrals = await this.referralRepo.count({
      where: { status: ReferralStatus.REWARDED },
    });

    let kpi = await this.kpiRepo.findOne({ where: { id: 'PLATFORM_SUMMARY' } });
    if (!kpi) {
      kpi = this.kpiRepo.create({ id: 'PLATFORM_SUMMARY' });
    }

    // Update with exact real totals
    kpi.total_members = totalMembers;
    kpi.active_members = activeMembers;
    kpi.total_customers = totalCustomers;
    kpi.total_businesses = totalBusinesses;
    kpi.total_vouchers_issued = totalVouchersIssued;
    kpi.total_vouchers_redeemed = totalVouchersRedeemed;
    kpi.total_revenue = totalRevenue;
    kpi.total_wallet_volume = totalWalletVolume;
    kpi.total_referrals = totalReferrals;
    kpi.converted_referrals = convertedReferrals;

    await this.kpiRepo.save(kpi);

    // Sync categories
    const businesses = await this.businessRepo.find({ relations: { category: true } });
    const catMap = new Map<string, { name: string; count: number }>();
    for (const b of businesses) {
      if (b.category_id) {
        const name = b.category?.name || 'Category';
        const existing = catMap.get(b.category_id) || { name, count: 0 };
        existing.count += 1;
        catMap.set(b.category_id, existing);
      }
    }

    for (const [catId, val] of catMap.entries()) {
      let metric = await this.categoryRepo.findOne({ where: { category_id: catId } });
      if (!metric) {
        metric = this.categoryRepo.create({
          category_id: catId,
          category_name: val.name,
          business_count: val.count,
        });
      } else {
        metric.category_name = val.name;
        metric.business_count = val.count;
      }
      await this.categoryRepo.save(metric);
    }

    // Ensure current month metric exists
    await this.getOrCreateMonthlyMetric();

    this.logger.log('Analytics reconciliation completed successfully.');
  }
}
