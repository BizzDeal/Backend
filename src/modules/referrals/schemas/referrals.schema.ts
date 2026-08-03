import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralType } from '../../../common/enums';
import { paginationQuerySchema, PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const createReferralSlipSchema = z.object({
  to_member_id: z.string().uuid('Valid member ID is required'),
  referral_type: z.nativeEnum(ReferralType),
  told_to_call: z.boolean().default(false),
  card_given: z.boolean().default(false),
  contact_name: z.string().min(1, 'Contact name is required').max(255),
  contact_phone: z.string().min(1, 'Contact phone is required').max(50),
  contact_email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  contact_address: z.string().max(500).optional().nullable().or(z.literal('')),
  comments: z.string().optional().nullable().or(z.literal('')),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

export class CreateReferralSlipDto {
  @ApiProperty({
    description: 'UUID of the member receiving the referral',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  to_member_id: string;

  @ApiProperty({
    description: 'Type of referral',
    enum: ReferralType,
    example: ReferralType.INSIDE,
  })
  referral_type: ReferralType;

  @ApiPropertyOptional({
    description: 'Whether the prospect was told to call',
    example: true,
  })
  told_to_call?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the prospect was given a card',
    example: false,
  })
  card_given?: boolean;

  @ApiProperty({
    description: 'Name of the contact/prospect',
    example: 'John Doe',
  })
  contact_name: string;

  @ApiProperty({
    description: 'Phone number of the contact/prospect',
    example: '9876543210',
  })
  contact_phone: string;

  @ApiPropertyOptional({
    description: 'Email of the contact/prospect',
    example: 'john@example.com',
  })
  contact_email?: string;

  @ApiPropertyOptional({
    description: 'Address of the contact/prospect',
    example: 'Hyderabad, India',
  })
  contact_address?: string;

  @ApiPropertyOptional({
    description: 'Any additional comments about the referral',
    example: 'Looking for web development services urgently.',
  })
  comments?: string;

  @ApiPropertyOptional({
    description: 'Rating (1-5) representing the warmth of the referral',
    example: 5,
  })
  rating?: number;
}

export const referralQuerySchema = z.object({
  type: z.enum(['GIVEN', 'RECEIVED']).optional(),
}).merge(paginationQuerySchema);

export class ReferralQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter slips by type: GIVEN or RECEIVED. If omitted, returns both.',
    enum: ['GIVEN', 'RECEIVED'],
  })
  type?: 'GIVEN' | 'RECEIVED';
}

export const adminReferralQuerySchema = z.object({
  search: z.string().optional(),
  referral_type: z.nativeEnum(ReferralType).optional(),
}).merge(paginationQuerySchema);

export class AdminReferralQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search string matching contact name, phone, referrer name, or recipient name',
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by referral type',
    enum: ReferralType,
  })
  referral_type?: ReferralType;
}

export const appreciateReferralSchema = z.object({
  appreciation_message: z.string().max(1000).optional().nullable(),
  cost_of_business: z.number().min(0, 'Cost cannot be negative'),
});

export class AppreciateReferralDto {
  @ApiPropertyOptional({
    description: 'A thank you message to the referrer',
    example: 'Thank you for referring John Doe! We successfully completed business worth 5000.',
  })
  appreciation_message?: string;

  @ApiProperty({
    description: 'The revenue generated or cost of business',
    example: 5000,
  })
  cost_of_business: number;
}


