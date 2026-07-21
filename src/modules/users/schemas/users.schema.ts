import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const userExistSchema = z.object({
  email: z.string().email('Valid email address is required'),
});

export class UserExistDto {
  @ApiProperty({
    description: 'The email address to check for existence in the system',
    example: 'user@example.com',
  })
  email: string;
}

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .optional()
    .or(z.literal('')),
  phone: z.string().min(10, 'Valid phone number is required').optional().or(z.literal('')),
  whatsapp: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  state_id: z.string().uuid().optional().nullable().or(z.literal('')),
  district_id: z.string().uuid().optional().nullable().or(z.literal('')),
  category_id: z.string().uuid().optional().or(z.literal('')),
  business_name: z.string().min(2).optional().or(z.literal('')),
  business_description: z.string().min(5).optional().or(z.literal('')),
  website: z.string().optional().nullable().or(z.literal('')),
  gst_number: z.string().optional().nullable().or(z.literal('')),
  business_address: z.string().optional().nullable().or(z.literal('')),
  business_state_id: z.string().uuid().optional().nullable().or(z.literal('')),
  business_district_id: z.string().uuid().optional().nullable().or(z.literal('')),
});

export class UpdateProfileDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Full name of the user',
    example: 'John Doe',
  })
  full_name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Phone number of the user',
    example: '7382772384',
  })
  phone?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'WhatsApp number of the user',
    example: '9876543210',
  })
  whatsapp?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Physical address of the user',
    example: '123 Business Street, Tech Park, Hyderabad',
  })
  address?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the state',
    example: 'a1111111-2222-3333-4444-555555555555',
  })
  state_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the district',
    example: 'b2222222-3333-4444-5555-666666666666',
  })
  district_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the business category (for members)',
    example: 'c89cd650-19cc-48fd-8b36-57530473a55f',
  })
  category_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Name of the business (for members)',
    example: 'Tech Solutions India Pvt Ltd',
  })
  business_name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Description of the business (for members)',
    example: 'Providing top-notch IT consulting and cloud solutions.',
  })
  business_description?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Website of the business (for members)',
    example: 'https://techsolutions.in',
  })
  website?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'GST number of the business (for members)',
    example: '36AAAAA0000A1Z5',
  })
  gst_number?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Physical address of the business (for members)',
    example: '456 Business Park, Mumbai',
  })
  business_address?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the business state',
    example: 'a1111111-2222-3333-4444-555555555555',
  })
  business_state_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the business district',
    example: 'b2222222-3333-4444-5555-666666666666',
  })
  business_district_id?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Replacement profile picture image upload',
  })
  profile_pic?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Replacement business logo image upload (for members)',
  })
  business_logo?: any;
}

export const memberActionSchema = z.object({
  memberId: z.string().uuid('Valid member ID is required'),
});

export class MemberActionDto {
  @ApiProperty({
    description: 'UUID of the member being acted upon',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  memberId: string;
}
