import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BizzCoinsService } from './bizz-coins.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  issueBizzCoinsSchema,
  IssueBizzCoinsDto,
  redeemBizzCoinsSchema,
  RedeemBizzCoinsDto,
} from './schemas/bizz-coins.schema';

@ApiTags('Bizz Coins')
@Controller('bizz-coins')
export class BizzCoinsController {
  constructor(private readonly bizzCoinsService: BizzCoinsService) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue Bizz Coins to Customer',
    description:
      'Allows Members (for their business) or Admins to issue Bizz Coins directly to a customer by phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bizz Coins issued successfully and customer wallet updated.',
  })
  async issue(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(issueBizzCoinsSchema)) dto: IssueBizzCoinsDto,
  ) {
    return this.bizzCoinsService.issueCoins(dto, user);
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem Bizz Coins for Customer',
    description:
      'Allows Members with an active Bizz Coins offer (or Admins) to redeem customer Bizz Coins by phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bizz Coins redeemed successfully and customer wallet updated.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Insufficient balance or member business has no active Bizz Coins offer.',
  })
  async redeem(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(redeemBizzCoinsSchema)) dto: RedeemBizzCoinsDto,
  ) {
    return this.bizzCoinsService.redeemCoins(dto, user);
  }

  @Get('customer-by-phone/:phone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Customer Coin Wallet by Phone',
    description:
      'Finds a customer by phone number and returns their profile details along with their current Bizz Coin balance and member active offer status.',
  })
  @ApiParam({
    name: 'phone',
    type: String,
    description: '10-digit customer phone number',
  })
  async getCustomerByPhone(
    @Param('phone') phone: string,
    @CurrentUser() user: User,
  ) {
    return this.bizzCoinsService.getCustomerCoinWalletByPhone(phone, user);
  }

  @Get('active-offer-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check Member Active Bizz Coin Offer Status',
    description:
      'Checks if the authenticated member business currently has an approved and active Bizz Coins offer.',
  })
  async checkActiveOfferStatus(@CurrentUser() user: User) {
    return this.bizzCoinsService.checkMemberActiveBizzCoinOffer(user);
  }

  @Get('my-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Own Bizz Coin Wallet',
    description: 'Retrieves the authenticated user Bizz Coin balance and transaction history.',
  })
  async getMyWallet(@CurrentUser() user: User) {
    return this.bizzCoinsService.getMyCoinsWallet(user.id);
  }
}

