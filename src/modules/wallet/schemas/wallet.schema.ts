import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WalletTransactionType,
  WalletReferenceType,
} from '../../../common/enums';
import { paginationQuerySchema, PaginationQueryDto } from '../../../common/dto/pagination.dto';

const numberPreprocess = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return val;
  const num = Number(val);
  return isNaN(num) ? val : num;
};

export const creditWalletSchema = z.object({
  user_id: z.string().uuid({ message: 'Valid user_id UUID is required' }),
  amount: z.preprocess(
    numberPreprocess,
    z.number().positive({ message: 'Amount must be a positive number' }),
  ),
  description: z.string().optional(),
  reference_type: z.nativeEnum(WalletReferenceType).optional(),
  reference_id: z.string().uuid().optional(),
});

export class CreditWalletDto {
  @ApiProperty({
    type: String,
    description: 'UUID of the customer/user whose wallet is being credited',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    type: Number,
    description: 'Positive amount to credit to the wallet balance',
    example: 500,
  })
  amount: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional description or reason for crediting the wallet',
    example: 'Promotional credit adjustment',
  })
  description?: string;

  @ApiPropertyOptional({
    enum: WalletReferenceType,
    description: 'Reference type for the credit transaction',
    example: WalletReferenceType.MANUAL,
  })
  reference_type?: WalletReferenceType;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional reference UUID (e.g. voucher ID or referral ID)',
    example: '987fcdeb-51a2-43d7-9012-345678901234',
  })
  reference_id?: string;
}

export const debitWalletSchema = z.object({
  user_id: z.string().uuid({ message: 'Valid user_id UUID is required' }),
  amount: z.preprocess(
    numberPreprocess,
    z.number().positive({ message: 'Amount must be a positive number' }),
  ),
  description: z.string().optional(),
  reference_type: z.nativeEnum(WalletReferenceType).optional(),
  reference_id: z.string().uuid().optional(),
});

export class DebitWalletDto {
  @ApiProperty({
    type: String,
    description: 'UUID of the customer/user whose wallet is being debited',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    type: Number,
    description: 'Positive amount to debit from the wallet balance',
    example: 200,
  })
  amount: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional description or reason for debiting the wallet',
    example: 'Admin manual debit adjustment',
  })
  description?: string;

  @ApiPropertyOptional({
    enum: WalletReferenceType,
    description: 'Reference type for the debit transaction',
    example: WalletReferenceType.MANUAL,
  })
  reference_type?: WalletReferenceType;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional reference UUID',
    example: '987fcdeb-51a2-43d7-9012-345678901234',
  })
  reference_id?: string;
}

export const walletQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  type: z.nativeEnum(WalletTransactionType).optional(),
  reference_type: z.nativeEnum(WalletReferenceType).optional(),
  states: z.string().optional(),
  districts: z.string().optional(),
  search: z.string().optional(),
}).merge(paginationQuerySchema);

export class WalletQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filter transactions by user UUID (Admin only)',
  })
  user_id?: string;

  @ApiPropertyOptional({
    enum: WalletTransactionType,
    description: 'Filter transactions by transaction type',
    example: WalletTransactionType.CREDIT,
  })
  type?: WalletTransactionType;

  @ApiPropertyOptional({
    enum: WalletReferenceType,
    description: 'Filter transactions by reference type',
    example: WalletReferenceType.VOUCHER,
  })
  reference_type?: WalletReferenceType;

  @ApiPropertyOptional({
    description: 'Comma-separated state UUIDs for filtering',
  })
  states?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated district UUIDs for filtering',
  })
  districts?: string;

  @ApiPropertyOptional({
    description: 'Search keyword matching transaction description, customer full name, email, phone, or voucher code',
  })
  search?: string;
}
