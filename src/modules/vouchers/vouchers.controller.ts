import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  issueVoucherSchema,
  IssueVoucherDto,
  redeemVoucherSchema,
  RedeemVoucherDto,
  voucherQuerySchema,
  VoucherQueryDto,
} from './schemas/vouchers.schema';

@ApiTags('Vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue Voucher',
    description:
      'Issues a new voucher for an active, approved promotional offer. The voucher is tagged to the authenticated customer.',
  })
  @ApiResponse({
    status: 201,
    description: 'Voucher issued successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Offer is unapproved, inactive, or expired.',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found.',
  })
  async issue(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(issueVoucherSchema)) dto: IssueVoucherDto,
  ) {
    return this.vouchersService.issueVoucher(dto, user);
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem Voucher',
    description:
      'Redeems an issued voucher using its unique code. Only Admins or the Business Owner (Member) who listed the deal can redeem a voucher. Customers cannot self-redeem. Automatically credits wallet balance or savings if applicable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher redeemed successfully and wallet updated.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request: Voucher already redeemed, cancelled, or expired.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: Only the owning business member or admin can redeem.',
  })
  @ApiResponse({
    status: 404,
    description: 'Voucher not found.',
  })
  async redeem(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(redeemVoucherSchema)) dto: RedeemVoucherDto,
  ) {
    return this.vouchersService.redeemVoucher(dto, user);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Voucher History',
    description:
      'Retrieves the list of vouchers without pagination. Customers see their claimed vouchers; Members see vouchers for their businesses; Admins see all vouchers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher history returned successfully.',
  })
  async getHistory(@Query() query: any, @CurrentUser() user: User) {
    try {
      const parsedQuery = voucherQuerySchema.parse(query || {});
      return await this.vouchersService.findAll(parsedQuery, user);
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
  }

  @Get('customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Customer Voucher List',
    description:
      'Retrieves all vouchers issued to the authenticated customer without pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer voucher list returned successfully.',
  })
  async getCustomerVouchers(@Query() query: any, @CurrentUser() user: User) {
    try {
      const parsedQuery = voucherQuerySchema.parse(query || {});
      const customerQuery =
        user.role === UserRole.CUSTOMER
          ? { ...parsedQuery, customer_id: user.id }
          : parsedQuery;
      return await this.vouchersService.findAll(customerQuery, user);
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Voucher Details',
    description:
      'Retrieves detailed information for a specific voucher by UUID or unique voucher code, including offer, business, customer, and redemption details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher details returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: No access to view this voucher.',
  })
  @ApiResponse({
    status: 404,
    description: 'Voucher not found.',
  })
  async getDetails(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vouchersService.findOne(id, user);
  }
}
