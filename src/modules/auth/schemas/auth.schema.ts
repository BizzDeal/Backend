import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpPurpose } from '../../../common/enums';

export const loginSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
});

export class LoginDto {
  @ApiProperty({
    description: 'The unique phone number registered with the user account',
    example: '9876543210',
  })
  phone: string;

  @ApiProperty({
    description: 'The secure 4+ digit numeric PIN for the user account',
    example: '1234',
  })
  pin: string;
}

export const registerMemberSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  email: z.string().email('Invalid email address').optional(),
});

export class RegisterMemberDto {
  @ApiProperty({
    description: 'The full name of the member/entrepreneur',
    example: 'John Doe',
  })
  full_name: string;

  @ApiProperty({
    description: 'The unique phone number of the member',
    example: '9876543210',
  })
  phone: string;

  @ApiProperty({
    description: 'The secure 4+ digit numeric PIN for the new member account',
    example: '1234',
  })
  pin: string;

  @ApiPropertyOptional({
    description: 'The optional email address of the member',
    example: 'john.doe@example.com',
  })
  email?: string;
}

export const registerCustomerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  email: z.string().email('Invalid email address').optional(),
});

export class RegisterCustomerDto {
  @ApiProperty({
    description: 'The full name of the customer',
    example: 'Jane Smith',
  })
  full_name: string;

  @ApiProperty({
    description: 'The unique phone number of the customer',
    example: '9876543211',
  })
  phone: string;

  @ApiProperty({
    description: 'The secure 4+ digit numeric PIN for the new customer account',
    example: '5678',
  })
  pin: string;

  @ApiPropertyOptional({
    description: 'The optional email address of the customer',
    example: 'jane.smith@example.com',
  })
  email?: string;
}

export const sendOtpSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  purpose: z.nativeEnum(OtpPurpose),
});

export class SendOtpDto {
  @ApiProperty({
    description: 'The destination phone number to receive the OTP',
    example: '9876543210',
  })
  phone: string;

  @ApiProperty({
    description: 'The purpose of generating this OTP',
    enum: OtpPurpose,
    example: OtpPurpose.REGISTER,
  })
  purpose: OtpPurpose;
}

export const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  otp: z.string().min(4, 'OTP must be at least 4 characters'),
  purpose: z.nativeEnum(OtpPurpose),
});

export class VerifyOtpDto {
  @ApiProperty({
    description: 'The phone number linked with the OTP request',
    example: '9876543210',
  })
  phone: string;

  @ApiProperty({
    description: 'The OTP code received by the user',
    example: '123456',
  })
  otp: string;

  @ApiProperty({
    description: 'The purpose for which the OTP was requested',
    enum: OtpPurpose,
    example: OtpPurpose.REGISTER,
  })
  purpose: OtpPurpose;
}

export const forgotPinSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
});

export class ForgotPinDto {
  @ApiProperty({
    description: 'The phone number associated with the forgotten PIN',
    example: '9876543210',
  })
  phone: string;
}

export const resetPinSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  otp: z.string().min(4, 'OTP must be at least 4 characters'),
  newPin: z.string().min(4, 'New PIN must be at least 4 characters'),
});

export class ResetPinDto {
  @ApiProperty({
    description: 'The phone number associated with the PIN reset',
    example: '9876543210',
  })
  phone: string;

  @ApiProperty({
    description: 'The OTP code received for verification',
    example: '123456',
  })
  otp: string;

  @ApiProperty({
    description: 'The new secure 4+ digit numeric PIN',
    example: '4321',
  })
  newPin: string;
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
