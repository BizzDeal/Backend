import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
});

export class LoginDto {
  @ApiProperty({
    description: 'The unique email address registered with the user account',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The secure 4+ digit numeric PIN for the user account',
    example: '1234',
  })
  pin: string;
}

export const registerMemberSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  whatsapp: z.string().optional().or(z.literal('')).refine(val => !val || /^[0-9]{10}$/.test(val), { message: 'WhatsApp number must be exactly 10 digits' }).transform(val => val === '' ? null : val),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address must be at least 5 characters if provided').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  state_id: z.string().uuid('Valid state UUID is required'),
  district_id: z.string().uuid('Valid district UUID is required').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  business_name: z.string().min(2, 'Business name is required'),
  category_id: z.string().uuid('Valid business category UUID is required'),
  business_description: z.string().min(5, 'Business description is required'),
  website: z.string().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  gst_number: z.string().optional().or(z.literal('')).transform(val => val === '' ? null : val),
  business_address: z.string().min(5, 'Business address must be at least 5 characters').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  business_state_id: z.string().uuid('Valid state UUID is required').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  business_district_id: z.string().uuid('Valid district UUID is required').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  reference_code: z.string().optional().or(z.literal('')).transform(val => val === '' ? null : val),
});

export class RegisterMemberDto {
  @ApiProperty({
    type: String,
    description: 'The full name of the member/entrepreneur',
    example: 'John Doe',
  })
  full_name: string;

  @ApiPropertyOptional({
    type: String,
    description: 'The unique phone number of the member',
    example: '9876543210',
  })
  phone?: string | null;

  @ApiProperty({
    type: String,
    description: 'The secure 4+ digit numeric PIN for the new member account',
    example: '1234',
  })
  pin: string;

  @ApiPropertyOptional({
    type: String,
    description: 'WhatsApp number of the member',
    example: '9876543210',
  })
  whatsapp?: string;

  @ApiProperty({
    type: String,
    description: 'Mandatory email address of the member',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Complete address of the member or business',
    example: '123 Business Street, Tech Park, Hyderabad',
  })
  address?: string | null;

  @ApiProperty({
    type: String,
    description: 'UUID of the selected state',
    example: 'a1111111-2222-3333-4444-555555555555',
  })
  state_id: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the selected district',
    example: 'b2222222-3333-4444-5555-666666666666',
  })
  district_id?: string | null;

  @ApiProperty({
    type: String,
    description: 'Name of the business being registered',
    example: 'Tech Solutions India Pvt Ltd',
  })
  business_name: string;

  @ApiProperty({
    type: String,
    description: 'UUID of the selected business category',
    example: 'c0a80121-8888-4e89-a111-222222222222',
  })
  category_id: string;

  @ApiProperty({
    type: String,
    description: 'Detailed description of the business and its offerings',
    example: 'Providing top-notch IT consulting and cloud solutions.',
  })
  business_description: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Official website or social media URL of the business',
    example: 'https://techsolutions.in',
  })
  website?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'GST Number of the business',
    example: '36AAAAA0000A1Z5',
  })
  gst_number?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Complete address of the business',
    example: '456 Business Lane, Tech Park, Hyderabad',
  })
  business_address?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the selected business state',
    example: 'a1111111-2222-3333-4444-555555555555',
  })
  business_state_id?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the selected business district',
    example: 'b2222222-3333-4444-5555-666666666666',
  })
  business_district_id?: string | null;



  @ApiPropertyOptional({
    type: String,
    description: 'Optional referral/reference code matching a pending referral',
    example: 'BD-JOHN-1234',
  })
  reference_code?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture image upload',
  })
  profile_pic?: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Mandatory payment receipt image/document upload',
  })
  payment_receipt: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional business logo image upload',
  })
  business_logo?: any;
}

export const registerCustomerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  phone: z.string().optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  whatsapp: z.string().min(10, 'Valid WhatsApp number is required').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address is required').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export class RegisterCustomerDto {
  @ApiPropertyOptional({
    type: String,
    description: 'The full name of the customer',
    example: 'Jane Smith',
  })
  full_name?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'The unique phone number of the customer',
    example: '9876543211',
  })
  phone?: string | null;

  @ApiProperty({
    type: String,
    description: 'The secure 4+ digit numeric PIN for the new customer account',
    example: '5678',
  })
  pin: string;

  @ApiPropertyOptional({
    type: String,
    description: 'The WhatsApp number of the customer',
    example: '9876543211',
  })
  whatsapp?: string | null;

  @ApiProperty({
    type: String,
    description: 'The email address of the customer',
    example: 'jane.smith@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: 'The physical address of the customer',
    example: '456 Customer Lane, Hyderabad',
  })
  address?: string | null;

  @ApiProperty({
    type: String,
    description: 'The 6-digit OTP sent to the email address',
    example: '123456',
  })
  otp: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Customer profile image upload',
  })
  profile_image?: any;
}

export const registerAdminSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  whatsapp: z.string().min(10, 'Valid WhatsApp number is required'),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export class RegisterAdminDto {
  @ApiProperty({
    type: String,
    description: 'The full name of the admin',
    example: 'Admin User',
  })
  full_name: string;

  @ApiPropertyOptional({
    type: String,
    description: 'The unique phone number of the admin',
    example: '9876543200',
  })
  phone?: string | null;

  @ApiProperty({
    type: String,
    description: 'The secure 4+ digit numeric PIN for the new admin account',
    example: '1234',
  })
  pin: string;

  @ApiProperty({
    type: String,
    description: 'The WhatsApp number of the admin',
    example: '9876543200',
  })
  whatsapp: string;

  @ApiProperty({
    type: String,
    description: 'The mandatory email address of the admin',
    example: 'admin@bizzdeal.com',
  })
  email: string;

  @ApiProperty({
    type: String,
    description: 'The physical address of the admin',
    example: '101 Admin Tower, Tech Park, Hyderabad',
  })
  address: string;

  @ApiProperty({
    type: String,
    description:
      'The 6-digit OTP sent to the email address',
    example: '123456',
  })
  otp: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Admin profile image upload',
  })
  profile_image?: any;
}

export const forgotPinSchema = z.object({
  email: z.string().email('Valid email address is required'),
});

export class ForgotPinDto {
  @ApiProperty({
    description: 'The email address associated with the forgotten PIN',
    example: 'user@example.com',
  })
  email: string;
}

export const resetPinSchema = z.object({
  email: z.string().email('Valid email address is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPin: z.string().min(4, 'New PIN must be at least 4 characters'),
});

export class ResetPinDto {
  @ApiProperty({
    description: 'The email address associated with the PIN reset',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description:
      'The 6-digit OTP sent to the email address',
    example: '123456',
  })
  otp: string;

  @ApiProperty({
    description: 'The new secure 4+ digit numeric PIN',
    example: '4321',
  })
  newPin: string;
}

export const sendOtpSchema = z.object({
  email: z.string().email('Valid email address is required'),
  purpose: z.enum(['register', 'forgot-pin']),
});

export class SendOtpDto {
  @ApiProperty({
    description: 'The email address to send the OTP to',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The purpose of the OTP (register or forgot-pin)',
    example: 'register',
    enum: ['register', 'forgot-pin'],
  })
  purpose: 'register' | 'forgot-pin';
}

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The active refresh token used to generate a new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The JWT verification token sent to the user email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;
}
