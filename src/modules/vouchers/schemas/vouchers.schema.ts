import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherStatus } from '../../../common/enums';

export const issueVoucherSchema = z.object({
  offer_id: z.string().uuid({ message: 'Valid offer_id UUID is required' }),
});

export class IssueVoucherDto {
  @ApiProperty({
    type: String,
    description: 'UUID of the offer to claim/issue a voucher for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  offer_id: string;
}

export const redeemVoucherSchema = z.object({
  voucher_code: z.string().min(1, { message: 'Voucher code is required' }),
  bill_amount: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    }, z.number().nonnegative().nullable())
    .optional(),
});

export class RedeemVoucherDto {
  @ApiProperty({
    type: String,
    description: 'Unique alphanumeric voucher code presented by the customer',
    example: 'VOU-ABC123XYZ',
  })
  voucher_code: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Optional total bill amount or transaction amount to calculate dynamic percentage savings',
    example: 1000,
  })
  bill_amount?: number | null;
}

export const voucherQuerySchema = z.object({
  status: z.nativeEnum(VoucherStatus).optional(),
  customer_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  offer_id: z.string().uuid().optional(),
  voucher_code: z.string().optional(),
});

export class VoucherQueryDto {
  @ApiPropertyOptional({
    enum: VoucherStatus,
    description: 'Filter vouchers by status',
    example: VoucherStatus.ISSUED,
  })
  status?: VoucherStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter vouchers by customer UUID',
  })
  customer_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter vouchers by business UUID',
  })
  business_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter vouchers by offer UUID',
  })
  offer_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by exact or partial voucher code',
  })
  voucher_code?: string;
}
