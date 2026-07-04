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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  creditWalletSchema,
  CreditWalletDto,
  debitWalletSchema,
  DebitWalletDto,
  walletQuerySchema,
} from './schemas/wallet.schema';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Wallet Balance & Total Savings',
    description:
      'Retrieves the wallet balance and total savings for the authenticated user. Admins can view any user wallet by passing the optional user_id query parameter. If no wallet exists yet, it will be automatically initialized.',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    type: String,
    description: 'Optional UUID of target user (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: No permission to view target wallet.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async getBalance(
    @CurrentUser() user: User,
    @Query('user_id') userId?: string,
  ) {
    return this.walletService.getBalance(userId, user);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Wallet Transaction History',
    description:
      'Retrieves the complete list of wallet transactions without pagination. Customers and Members only see their own transactions; Admins can see all or filter by user_id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history returned successfully.',
  })
  async getHistory(@Query() query: any, @CurrentUser() user: User) {
    try {
      const parsedQuery = walletQuerySchema.parse(query || {});
      return await this.walletService.getHistory(parsedQuery, user);
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
  }

  @Get('savings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Wallet Savings History',
    description:
      'Retrieves all wallet transactions of type SAVING without pagination. Scoped to the authenticated user unless called by an Admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Savings history returned successfully.',
  })
  async getSavings(@Query() query: any, @CurrentUser() user: User) {
    try {
      const parsedQuery = walletQuerySchema.parse(query || {});
      return await this.walletService.getSavings(parsedQuery, user);
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
  }

  @Post('credit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Credit Wallet (Admin Only)',
    description:
      'Credits a user wallet balance inside an atomic DB transaction and records an immutable CREDIT transaction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet credited successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Invalid amount or user_id.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admins can credit wallets.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async credit(
    @Body(new ZodValidationPipe(creditWalletSchema)) dto: CreditWalletDto,
  ) {
    return this.walletService.creditWallet(dto);
  }

  @Post('debit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Debit Wallet (Admin Only)',
    description:
      'Debits a user wallet balance inside an atomic DB transaction and records an immutable DEBIT transaction. Strictly rejects the transaction if wallet balance is insufficient.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet debited successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Insufficient wallet balance.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admins can debit wallets.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async debit(
    @Body(new ZodValidationPipe(debitWalletSchema)) dto: DebitWalletDto,
  ) {
    return this.walletService.debitWallet(dto);
  }
}
