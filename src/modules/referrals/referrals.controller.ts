import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createReferralSlipSchema,
  CreateReferralSlipDto,
  referralQuerySchema,
  ReferralQueryDto,
  adminReferralQuerySchema,
  AdminReferralQueryDto,
  appreciateReferralSchema,
  AppreciateReferralDto,
  adminDailyStatsQuerySchema,
  AdminDailyStatsQueryDto,
} from './schemas/referrals.schema';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a Referral Slip',
    description: 'Creates a new member-to-member referral slip.',
  })
  @ApiResponse({
    status: 201,
    description: 'Referral slip created successfully.',
  })
  async createReferralSlip(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createReferralSlipSchema)) dto: CreateReferralSlipDto,
  ) {
    return this.referralsService.createReferralSlip(user.id, dto);
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get All Referral Slips for Admin',
    description: 'Retrieves all referral slips across all members with optional filters and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of referral slips for admin returned successfully.',
  })
  async getAdminReferralSlips(@Query() queryParams: any) {
    let query: AdminReferralQueryDto = {};
    try {
      query = adminReferralQuerySchema.parse(queryParams || {});
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
    return this.referralsService.getAdminReferralSlips(query);
  }

  @Get('admin/daily-stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Daily Referral Stats for Admin',
    description: 'Retrieves daily referral counts for a given month and year.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily referral stats returned successfully.',
  })
  async getAdminDailyStats(@Query() queryParams: any) {
    let query: AdminDailyStatsQueryDto = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    try {
      query = adminDailyStatsQuerySchema.parse(queryParams || {});
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
    return this.referralsService.getAdminDailyStats(query);
  }

  @Get()
  @Roles(UserRole.MEMBER)
  @ApiOperation({
    summary: 'Get Referral Slips',
    description: 'Retrieves all referral slips given or received by the current member.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of referral slips returned successfully.',
  })
  async getReferralSlips(
    @CurrentUser() user: User,
    @Query() queryParams: any,
  ) {
    let query: ReferralQueryDto = {};
    try {
      query = referralQuerySchema.parse(queryParams || {});
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
    return this.referralsService.getReferralSlips(user.id, query);
  }

  @Post(':id/appreciate')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Appreciate a Received Referral',
    description: 'Marks a received referral as appreciated, logging revenue and sending a thank you message.',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral appreciated successfully.',
  })
  async appreciateReferral(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(appreciateReferralSchema)) dto: AppreciateReferralDto,
  ) {
    return this.referralsService.appreciateReferral(user.id, id, dto);
  }
}

