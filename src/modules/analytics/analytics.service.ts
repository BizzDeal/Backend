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
import { RegionFilterDto } from '../../common/dto/region-filter.dto';

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

  async getOverviewAnalytics(filter?: RegionFilterDto): Promise<{ success: boolean; data: AdminAnalyticsOverviewDto }> {
    if (!filter?.states && !filter?.districts) {
      const kpi = await this.getOrCreatePlatformKpi();
      const recentMonths = await this.monthlyRepo.find({
        order: { period_month: 'ASC' },
        take: 7,
      });

      const dates = recentMonths.map((m) => m.period_month);
      const amounts = recentMonths.map((m) => Number(m.revenue || 0));

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

    const states = filter.states ? filter.states.split(',') : [];
    const districts = filter.districts ? filter.districts.split(',') : [];

    const applyLocationFilter = (qb: any, alias: string) => {
      if (states.length > 0) {
        qb.andWhere(`${alias}.state_id IN (:...states)`, { states });
      }
      if (districts.length > 0) {
        qb.andWhere(`${alias}.district_id IN (:...districts)`, { districts });
      }
    };

    const membersQb = this.userRepo.createQueryBuilder('user').where('user.role = :role', { role: UserRole.MEMBER });
    applyLocationFilter(membersQb, 'user');
    const totalMembers = await membersQb.getCount();

    const activeMembersQb = this.userRepo.createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.MEMBER })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE });
    applyLocationFilter(activeMembersQb, 'user');
    const activeMembers = await activeMembersQb.getCount();

    const customersQb = this.userRepo.createQueryBuilder('user').where('user.role = :role', { role: UserRole.CUSTOMER });
    applyLocationFilter(customersQb, 'user');
    const totalCustomers = await customersQb.getCount();

    const vouchersQb = this.voucherRepo.createQueryBuilder('voucher')
      .leftJoin('voucher.business', 'business')
      .leftJoin('business.owner', 'owner')
      .where('voucher.status = :status', { status: VoucherStatus.REDEEMED });
    applyLocationFilter(vouchersQb, 'owner');
    const totalVouchers = await vouchersQb.getCount();

    const txQb = this.txRepo.createQueryBuilder('tx')
      .leftJoin('tx.user', 'user')
      .where('tx.type = :type', { type: WalletTransactionType.CREDIT });
    applyLocationFilter(txQb, 'user');
    
    const revenueResult = await txQb.clone()
      .select('SUM(tx.amount)', 'total')
      .getRawOne();
    const revenue = Number(revenueResult?.total || 0);

    const historyResult = await txQb.clone()
      .select("TO_CHAR(tx.created_at, 'YYYY-MM')", 'month')
      .addSelect("SUM(tx.amount)", 'amount')
      .groupBy("TO_CHAR(tx.created_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(7)
      .getRawMany();
      
    historyResult.reverse();

    const dates = historyResult.map((r) => r.month);
    const amounts = historyResult.map((r) => Number(r.amount || 0));

    if (dates.length === 0) {
      dates.push(this.getCurrentMonthKey());
      amounts.push(0);
    }

    const data: AdminAnalyticsOverviewDto = {
      totalMembers,
      activeMembers,
      totalCustomers,
      totalVouchers,
      revenue,
      revenueHistory: {
        dates,
        amounts,
      },
    };

    return { success: true, data };
  }

  async getDetailedAnalytics(filter?: RegionFilterDto): Promise<{ success: boolean; data: DetailedAnalyticsDto }> {
    if (!filter?.states && !filter?.districts) {
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

    const states = filter.states ? filter.states.split(',') : [];
    const districts = filter.districts ? filter.districts.split(',') : [];

    const applyLocationFilter = (qb: any, alias: string) => {
      if (states.length > 0) {
        qb.andWhere(`${alias}.state_id IN (:...states)`, { states });
      }
      if (districts.length > 0) {
        qb.andWhere(`${alias}.district_id IN (:...districts)`, { districts });
      }
    };

    // --- KPIs ---
    const usersQb = this.userRepo.createQueryBuilder('user').where('user.role IN (:...roles)', { roles: [UserRole.MEMBER, UserRole.CUSTOMER] });
    applyLocationFilter(usersQb, 'user');
    const totalUsers = await usersQb.getCount();

    const businessesQb = this.businessRepo.createQueryBuilder('business').leftJoin('business.owner', 'owner');
    applyLocationFilter(businessesQb, 'owner');
    const totalBusinesses = await businessesQb.getCount();

    const vouchersQb = this.voucherRepo.createQueryBuilder('voucher')
      .leftJoin('voucher.business', 'business')
      .leftJoin('business.owner', 'owner')
      .where('voucher.status = :status', { status: VoucherStatus.REDEEMED });
    applyLocationFilter(vouchersQb, 'owner');
    const totalVouchersRedeemed = await vouchersQb.getCount();

    const txQb = this.txRepo.createQueryBuilder('tx')
      .leftJoin('tx.user', 'user')
      .where('tx.type IN (:...types)', { types: [WalletTransactionType.CREDIT, WalletTransactionType.DEBIT] });
    applyLocationFilter(txQb, 'user');
    const walletVolRes = await txQb.clone().select('SUM(tx.amount)', 'total').getRawOne();
    const totalWalletVolume = Number(walletVolRes?.total || 0);

    // --- User Growth (Last 7 Months) ---
    const userGrowthQuery = await this.userRepo.createQueryBuilder('user')
      .select("TO_CHAR(user.created_at, 'YYYY-MM')", 'month')
      .addSelect("SUM(CASE WHEN user.role = :customer THEN 1 ELSE 0 END)", 'customers')
      .addSelect("SUM(CASE WHEN user.role = :member THEN 1 ELSE 0 END)", 'members')
      .setParameters({ customer: UserRole.CUSTOMER, member: UserRole.MEMBER })
      .where('user.role IN (:customer, :member)')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'u2').where('u2.id = user.id');
        applyLocationFilter(sub, 'u2');
        return 'EXISTS ' + sub.getQuery();
      })
      .groupBy("TO_CHAR(user.created_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(7)
      .getRawMany();

    userGrowthQuery.reverse();

    // --- Voucher Performance (Last 7 Months) ---
    const voucherIssuedQuery = await this.voucherRepo.createQueryBuilder('voucher')
      .select("TO_CHAR(voucher.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'issued')
      .leftJoin('voucher.business', 'business')
      .leftJoin('business.owner', 'owner')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'o2').where('o2.id = business.owner_id');
        applyLocationFilter(sub, 'o2');
        return 'EXISTS ' + sub.getQuery();
      })
      .groupBy("TO_CHAR(voucher.created_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(7)
      .getRawMany();
    
    const voucherRedeemedQuery = await this.voucherRepo.createQueryBuilder('voucher')
      .select("TO_CHAR(voucher.redeemed_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'redeemed')
      .leftJoin('voucher.business', 'business')
      .leftJoin('business.owner', 'owner')
      .where('voucher.status = :status', { status: VoucherStatus.REDEEMED })
      .andWhere('voucher.redeemed_at IS NOT NULL')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'o2').where('o2.id = business.owner_id');
        applyLocationFilter(sub, 'o2');
        return 'EXISTS ' + sub.getQuery();
      })
      .groupBy("TO_CHAR(voucher.redeemed_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(7)
      .getRawMany();

    // --- Business Distribution ---
    const bizDistQuery = await this.businessRepo.createQueryBuilder('business')
      .select('category.name', 'category_name')
      .addSelect('COUNT(business.id)', 'count')
      .leftJoin('business.category', 'category')
      .leftJoin('business.owner', 'owner')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'o2').where('o2.id = business.owner_id');
        applyLocationFilter(sub, 'o2');
        return 'EXISTS ' + sub.getQuery();
      })
      .groupBy('category.name')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // --- Wallet Volume ---
    const walletVolQuery = await this.txRepo.createQueryBuilder('tx')
      .select("TO_CHAR(tx.created_at, 'YYYY-MM')", 'month')
      .addSelect("SUM(CASE WHEN tx.type = :credit THEN tx.amount ELSE 0 END)", 'credits')
      .addSelect("SUM(CASE WHEN tx.type = :debit THEN tx.amount ELSE 0 END)", 'debits')
      .setParameters({ credit: WalletTransactionType.CREDIT, debit: WalletTransactionType.DEBIT })
      .leftJoin('tx.user', 'user')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'u2').where('u2.id = tx.user_id');
        applyLocationFilter(sub, 'u2');
        return 'EXISTS ' + sub.getQuery();
      })
      .groupBy("TO_CHAR(tx.created_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(7)
      .getRawMany();

    walletVolQuery.reverse();

    // --- Referral Stats ---
    const totalRef = await this.referralRepo.createQueryBuilder('ref')
      .leftJoin('ref.referrer', 'referrer')
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'u2').where('u2.id = ref.referrer_id');
        applyLocationFilter(sub, 'u2');
        return 'EXISTS ' + sub.getQuery();
      }).getCount();
      
    const convRef = await this.referralRepo.createQueryBuilder('ref')
      .leftJoin('ref.referrer', 'referrer')
      .where('ref.status = :status', { status: ReferralStatus.REWARDED })
      .andWhere((qb) => {
        const sub = qb.subQuery().select('1').from(User, 'u2').where('u2.id = ref.referrer_id');
        applyLocationFilter(sub, 'u2');
        return 'EXISTS ' + sub.getQuery();
      }).getCount();
      
    const conversionRate = totalRef > 0 ? Number(((convRef / totalRef) * 100).toFixed(1)) : 0;

    // Combine time series data
    const allMonths = new Set<string>();
    userGrowthQuery.forEach(r => allMonths.add(r.month));
    voucherIssuedQuery.forEach(r => allMonths.add(r.month));
    voucherRedeemedQuery.forEach(r => allMonths.add(r.month));
    walletVolQuery.forEach(r => allMonths.add(r.month));
    
    let months = Array.from(allMonths).sort();
    if (months.length === 0) {
      months.push(this.getCurrentMonthKey());
    }

    const customers = months.map(m => Number(userGrowthQuery.find(r => r.month === m)?.customers || 0));
    const members = months.map(m => Number(userGrowthQuery.find(r => r.month === m)?.members || 0));
    
    const issued = months.map(m => Number(voucherIssuedQuery.find(r => r.month === m)?.issued || 0));
    const redeemed = months.map(m => Number(voucherRedeemedQuery.find(r => r.month === m)?.redeemed || 0));
    
    const credits = months.map(m => Number(walletVolQuery.find(r => r.month === m)?.credits || 0));
    const debits = months.map(m => Number(walletVolQuery.find(r => r.month === m)?.debits || 0));
    
    const categoriesList = bizDistQuery.map(r => r.category_name || 'General');
    const countsList = bizDistQuery.map(r => Number(r.count || 0));

    const data: DetailedAnalyticsDto = {
      kpis: {
        totalUsers,
        totalBusinesses,
        totalVouchersRedeemed,
        totalWalletVolume,
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
        categories: categoriesList.length > 0 ? categoriesList : ['General'],
        counts: countsList.length > 0 ? countsList : [0],
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

    // --- FULLY RECALCULATE MONTHLY METRICS ---
    this.logger.log('Recalculating all historical monthly metrics from source tables...');
    await this.monthlyRepo.clear();

    const monthlyData = new Map<string, any>();
    const getMonthData = (month: string) => {
      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          period_month: month,
          new_customers: 0,
          new_members: 0,
          vouchers_issued: 0,
          vouchers_redeemed: 0,
          wallet_credits: 0,
          wallet_debits: 0,
          revenue: 0,
        });
      }
      return monthlyData.get(month);
    };

    // 1. User stats per month
    const userStats = await this.userRepo
      .createQueryBuilder('user')
      .select("TO_CHAR(user.created_at, 'YYYY-MM')", 'month')
      .addSelect("SUM(CASE WHEN user.role = :customer THEN 1 ELSE 0 END)", 'customers')
      .addSelect("SUM(CASE WHEN user.role = :member THEN 1 ELSE 0 END)", 'members')
      .setParameters({ customer: UserRole.CUSTOMER, member: UserRole.MEMBER })
      .groupBy("TO_CHAR(user.created_at, 'YYYY-MM')")
      .getRawMany();

    for (const stat of userStats) {
      if (!stat.month) continue;
      const data = getMonthData(stat.month);
      data.new_customers += Number(stat.customers || 0);
      data.new_members += Number(stat.members || 0);
    }

    // 2. Vouchers Issued per month
    const voucherIssued = await this.voucherRepo
      .createQueryBuilder('v')
      .select("TO_CHAR(v.created_at, 'YYYY-MM')", 'month')
      .addSelect("COUNT(*)", 'issued')
      .groupBy("TO_CHAR(v.created_at, 'YYYY-MM')")
      .getRawMany();

    for (const stat of voucherIssued) {
      if (!stat.month) continue;
      const data = getMonthData(stat.month);
      data.vouchers_issued += Number(stat.issued || 0);
    }

    // 3. Vouchers Redeemed per month
    const voucherRedeemed = await this.voucherRepo
      .createQueryBuilder('v')
      .select("TO_CHAR(v.redeemed_at, 'YYYY-MM')", 'month')
      .addSelect("COUNT(*)", 'redeemed')
      .where("v.status = :status", { status: VoucherStatus.REDEEMED })
      .andWhere("v.redeemed_at IS NOT NULL")
      .groupBy("TO_CHAR(v.redeemed_at, 'YYYY-MM')")
      .getRawMany();

    for (const stat of voucherRedeemed) {
      if (!stat.month) continue;
      const data = getMonthData(stat.month);
      data.vouchers_redeemed += Number(stat.redeemed || 0);
    }

    // 4. Wallet Transactions per month
    const walletStats = await this.txRepo
      .createQueryBuilder('tx')
      .select("TO_CHAR(tx.created_at, 'YYYY-MM')", 'month')
      .addSelect("SUM(CASE WHEN tx.type = :credit THEN tx.amount ELSE 0 END)", 'credits')
      .addSelect("SUM(CASE WHEN tx.type = :debit THEN tx.amount ELSE 0 END)", 'debits')
      .setParameters({ credit: WalletTransactionType.CREDIT, debit: WalletTransactionType.DEBIT })
      .groupBy("TO_CHAR(tx.created_at, 'YYYY-MM')")
      .getRawMany();

    for (const stat of walletStats) {
      if (!stat.month) continue;
      const data = getMonthData(stat.month);
      data.wallet_credits += Number(stat.credits || 0);
      data.wallet_debits += Number(stat.debits || 0);
      // Assuming revenue is total credits
      data.revenue += Number(stat.credits || 0); 
    }

    // Save all constructed monthly metrics
    const metricsArray = Array.from(monthlyData.values());
    if (metricsArray.length > 0) {
      const metricsToSave = this.monthlyRepo.create(metricsArray);
      await this.monthlyRepo.save(metricsToSave);
    }

    // Ensure current month metric exists even if empty
    await this.getOrCreateMonthlyMetric();

    this.logger.log('Analytics reconciliation completed successfully.');
  }
}
