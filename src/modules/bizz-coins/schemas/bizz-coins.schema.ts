import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const issueBizzCoinsSchema = z.object({
  customer_phone: z
    .string()
    .regex(/^\d{10}$/, 'Valid 10-digit phone number is required'),
  coins: z.coerce.number().min(1, 'Must issue at least 1 Bizz Coin'),
  description: z.string().optional(),
});

export class IssueBizzCoinsDto {
  @ApiProperty({
    description: '10-digit phone number of customer',
    example: '9876543210',
    type: String,
  })
  customer_phone: string;

  @ApiProperty({
    description: 'Amount of Bizz Coins to issue',
    example: 50,
    type: Number,
  })
  coins: number;

  @ApiPropertyOptional({
    description: 'Optional transaction description',
    example: 'Bonus for purchase',
    type: String,
  })
  description?: string;
}

export const redeemBizzCoinsSchema = z.object({
  customer_phone: z
    .string()
    .regex(/^\d{10}$/, 'Valid 10-digit phone number is required'),
  coins: z.coerce.number().min(1, 'Must redeem at least 1 Bizz Coin'),
  bill_amount: z.coerce.number().min(1, 'Bill amount must be at least 1'),
});

export class RedeemBizzCoinsDto {
  @ApiProperty({
    description: '10-digit phone number of customer',
    example: '9876543210',
    type: String,
  })
  customer_phone: string;

  @ApiProperty({
    description: 'Amount of Bizz Coins to redeem',
    example: 25,
    type: Number,
  })
  coins: number;

  @ApiProperty({
    description: 'Total bill amount for the transaction',
    example: 500,
    type: Number,
  })
  bill_amount: number;
}

