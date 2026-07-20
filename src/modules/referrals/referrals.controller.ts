import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { RegionFilterDto } from '../../common/dto/region-filter.dto';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Referral',
    description: 'Creates a new referral record for the authenticated user.',
  })
  @ApiResponse({ status: 201, description: 'Referral created successfully.' })
  async create(
    @Body()
    body: {
      referred_phone: string;
      referral_code: string;
      reward_amount?: number;
    },
    @CurrentUser() user: User,
  ) {
    return this.referralsService.create(body, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Referrals',
    description:
      'Retrieves all referrals for the authenticated user without pagination. Returns only foreign key IDs (referrer_id, referred_user_id) without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Referrals list returned successfully.',
  })
  async findAll(
    @CurrentUser() user: User,
    @Query() filter?: RegionFilterDto,
  ) {
    return this.referralsService.findAll(user, filter);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Referral By ID',
    description:
      'Retrieves details of a specific referral by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Referral details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Referral not found.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.referralsService.findOne(id, user);
  }

  @Post('check-contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check Contacts Eligibility',
    description:
      'Checks a list of contact phone numbers against users and existing active referrals, returning those which do not have a BizzDeal account and are not already referred.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns array of eligible phone numbers.',
  })
  async checkContacts(
    @Body() body: { phones: string[] },
  ) {
    return this.referralsService.checkContacts(body.phones);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk Create Referrals',
    description:
      'Creates multiple referral records in a single batch transaction.',
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk referrals created successfully.',
  })
  async bulkCreate(
    @Body()
    body: {
      referred_phones: string[];
      referral_code: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.referralsService.bulkCreate(body, user);
  }
}
