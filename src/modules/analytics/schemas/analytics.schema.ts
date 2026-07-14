import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class RevenueHistoryDto {
  @ApiProperty({ type: [String], example: ['2026-01', '2026-02', '2026-03'] })
  dates: string[];

  @ApiProperty({ type: [Number], example: [12000, 15000, 18000] })
  amounts: number[];
}

export class AdminAnalyticsOverviewDto {
  @ApiProperty({ example: 1250 })
  totalMembers: number;

  @ApiProperty({ example: 1100 })
  activeMembers: number;

  @ApiProperty({ example: 50000 })
  totalCustomers: number;

  @ApiProperty({ example: 85420 })
  totalVouchers: number;

  @ApiProperty({ example: 45000.5 })
  revenue: number;

  @ApiProperty({ type: RevenueHistoryDto })
  revenueHistory: RevenueHistoryDto;
}

export class DetailedKpisDto {
  @ApiProperty({ example: 51250 })
  totalUsers: number;

  @ApiProperty({ example: 3420 })
  totalBusinesses: number;

  @ApiProperty({ example: 42100 })
  totalVouchersRedeemed: number;

  @ApiProperty({ example: 1250000 })
  totalWalletVolume: number;
}

export class UserGrowthDto {
  @ApiProperty({ type: [String] })
  months: string[];

  @ApiProperty({ type: [Number] })
  customers: number[];

  @ApiProperty({ type: [Number] })
  members: number[];
}

export class VoucherPerformanceDto {
  @ApiProperty({ type: [String] })
  months: string[];

  @ApiProperty({ type: [Number] })
  issued: number[];

  @ApiProperty({ type: [Number] })
  redeemed: number[];
}

export class BusinessDistributionDto {
  @ApiProperty({ type: [String] })
  categories: string[];

  @ApiProperty({ type: [Number] })
  counts: number[];
}

export class WalletVolumeDto {
  @ApiProperty({ type: [String] })
  months: string[];

  @ApiProperty({ type: [Number] })
  credits: number[];

  @ApiProperty({ type: [Number] })
  debits: number[];
}

export class ReferralStatsDto {
  @ApiProperty({ example: 15400 })
  total: number;

  @ApiProperty({ example: 6200 })
  converted: number;

  @ApiProperty({ example: 40.2 })
  conversionRate: number;
}

export class DetailedAnalyticsDto {
  @ApiProperty({ type: DetailedKpisDto })
  kpis: DetailedKpisDto;

  @ApiProperty({ type: UserGrowthDto })
  userGrowth: UserGrowthDto;

  @ApiProperty({ type: VoucherPerformanceDto })
  voucherPerformance: VoucherPerformanceDto;

  @ApiProperty({ type: BusinessDistributionDto })
  businessDistribution: BusinessDistributionDto;

  @ApiProperty({ type: WalletVolumeDto })
  walletVolume: WalletVolumeDto;

  @ApiProperty({ type: ReferralStatsDto })
  referralStats: ReferralStatsDto;
}
