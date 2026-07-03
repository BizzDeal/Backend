import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const userExistSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
});

export class UserExistDto {
  @ApiProperty({
    description: 'The phone number to check for existence in the system',
    example: '9876543210',
  })
  phone: string;
}

export const updateProfileSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  phone: z.string().min(10, 'Valid phone number is required').optional(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  address: z.string().optional().nullable(),
  category_id: z.string().uuid().optional(),
  business_name: z.string().min(2).optional(),
  business_description: z.string().min(5).optional(),
  website: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
});

export class UpdateProfileDto {
  @ApiProperty({
    type: String,
    description: 'User ID (required when testing without authentication guard)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  userId: string;

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
  adminId: z.string().uuid().optional(),
});

export class MemberActionDto {
  @ApiProperty({
    description: 'UUID of the member being acted upon',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  memberId: string;

  @ApiPropertyOptional({
    description: 'UUID of the admin performing the action (when testing without auth guard)',
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  adminId?: string;
}

export const getProfileSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
});

export class GetProfileDto {
  @ApiProperty({
    description: 'UUID of the user whose profile details to retrieve',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  userId: string;
}
