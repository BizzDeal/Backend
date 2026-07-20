import { Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
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
import { RegionFilterDto } from '../../common/dto/region-filter.dto';

@ApiTags('Analytics & KPIs (Admin Only)')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get Platform Overview Analytics',
    description:
      'Retrieves instant platform health stats, customer/member totals, vouchers claimed, and revenue history. If region filters are applied, computes dynamically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform overview metrics returned successfully.',
    type: AdminAnalyticsOverviewDto,
  })
  async getOverview(@Query() filter?: RegionFilterDto) {
    return this.analyticsService.getOverviewAnalytics(filter);
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Get Detailed Platform Analytics',
    description:
      'Retrieves granular time-series user growth, voucher performance, business distribution, wallet volume, and referral conversions. Computes dynamically if filtered.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed analytics returned successfully.',
    type: DetailedAnalyticsDto,
  })
  async getDetailed(@Query() filter?: RegionFilterDto) {
    return this.analyticsService.getDetailedAnalytics(filter);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Sync/Recalculate Analytics Data',
    description: 'Fully recalculates all analytics KPIs and time-series data from primary tables.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics synced successfully.',
  })
  async syncAnalytics() {
    await this.analyticsService.syncExistingData();
    return { success: true, message: 'Analytics synced successfully' };
  }
}
