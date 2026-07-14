import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AdminAnalyticsOverviewDto,
  DetailedAnalyticsDto,
} from './schemas/analytics.schema';

@ApiTags('Analytics & KPIs (Admin Only)')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get Platform Overview Analytics ($O(1)$ Table Read)',
    description:
      'Retrieves instant platform health stats, customer/member totals, vouchers claimed, and revenue history directly from materialized counter tables.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform overview metrics returned successfully.',
    type: AdminAnalyticsOverviewDto,
  })
  async getOverview() {
    return this.analyticsService.getOverviewAnalytics();
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Get Detailed Platform Analytics ($O(1)$ Table Read)',
    description:
      'Retrieves granular time-series user growth, voucher performance, business distribution, wallet volume, and referral conversions directly from materialized counter tables.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed analytics returned successfully.',
    type: DetailedAnalyticsDto,
  })
  async getDetailed() {
    return this.analyticsService.getDetailedAnalytics();
  }
}
