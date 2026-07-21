import {
  Controller,
  Post,
  Get,
  Query,
  Res,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  loginSchema,
  registerMemberSchema,
  registerCustomerSchema,
  registerAdminSchema,
  forgotPinSchema,
  resetPinSchema,
  refreshTokenSchema,
  LoginDto,
  RegisterMemberDto,
  RegisterCustomerDto,
  RegisterAdminDto,
  ForgotPinDto,
  ResetPinDto,
  RefreshTokenDto,
  sendOtpSchema,
  SendOtpDto,
  verifyEmailSchema,
  VerifyEmailDto,
} from './schemas/auth.schema';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User Login',
    description:
      'Authenticates a user via phone and security PIN, returning access/refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Authentication successful. Returns access token, refresh token, and user profile details.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account is suspended/rejected.',
  })
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Mail OTP',
    description: 'Generates and sends a 6-digit OTP to the provided email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or unable to send email.',
  })
  async sendOtp(@Body(new ZodValidationPipe(sendOtpSchema)) dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify Email (Page)',
    description: 'Verifies the email address using the token and renders a confirmation page.',
  })
  async verifyEmailPage(@Query('token') token: string, @Res() res: Response) {
    try {
      const result = await this.authService.verifyEmail(token);
      return res.render('verify-email', { success: result.success, message: result.message });
    } catch (error) {
      return res.render('verify-email', { success: false, message: 'Invalid or expired token.' });
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Email',
    description: 'Verifies the email address using the token sent to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token, or account is already verified.',
  })
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('register-member')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Register Member / Entrepreneur',
    description:
      'Registers a new member account with optional profile_pic and mandatory payment_receipt file uploads. An email verification link is sent to the user. Status is set to UNVERIFIED until the link is clicked, after which it becomes PENDING for admin approval.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Member registered successfully. Returns initial session tokens and profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or Firebase token verification failed.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already registered.',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profile_pic', maxCount: 1 },
      { name: 'payment_receipt', maxCount: 1 },
      { name: 'business_logo', maxCount: 1 },
    ]),
  )
  async registerMember(
    @Body(new ZodValidationPipe(registerMemberSchema)) dto: RegisterMemberDto,
    @UploadedFiles()
    files?: {
      profile_pic?: Express.Multer.File[];
      payment_receipt?: Express.Multer.File[];
      business_logo?: Express.Multer.File[];
    },
  ) {
    return this.authService.registerMember(dto, files);
  }

  @Post('register-customer')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Register Customer',
    description:
      'Registers a new customer account with optional profile_image upload and profile details. Requires a valid 6-digit OTP sent to the email. Customer is immediately active.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Customer registered successfully. Returns initial session tokens and profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or Firebase token verification failed.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already registered.',
  })
  @UseInterceptors(FileInterceptor('profile_image'))
  async registerCustomer(
    @Body(new ZodValidationPipe(registerCustomerSchema))
    dto: RegisterCustomerDto,
    @UploadedFile() profile_image?: Express.Multer.File,
  ) {
    return this.authService.registerCustomer(dto, profile_image);
  }

  @Post('register-admin')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Register Admin',
    description:
      'Registers a new admin account with optional profile_image upload and profile details. Requires a valid 6-digit OTP sent to the email. Admin is immediately active.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Admin registered successfully. Returns initial session tokens and profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or Firebase token verification failed.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already registered.',
  })
  @UseInterceptors(FileInterceptor('profile_image'))
  async registerAdmin(
    @Body(new ZodValidationPipe(registerAdminSchema))
    dto: RegisterAdminDto,
    @UploadedFile() profile_image?: Express.Multer.File,
  ) {
    return this.authService.registerAdmin(dto, profile_image);
  }

  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forgot PIN',
    description:
      'Validates that a user exists with the given email number before triggering a Mail OTP.',
  })
  @ApiResponse({
    status: 200,
    description:
      'User verified successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Email not found in registered users.',
  })
  async forgotPin(
    @Body(new ZodValidationPipe(forgotPinSchema)) dto: ForgotPinDto,
  ) {
    return this.authService.forgotPin(dto.email);
  }

  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset PIN',
    description:
      'Resets the security PIN of a user after verifying ownership of the email via a 6-digit OTP.',
  })
  @ApiResponse({
    status: 200,
    description: 'PIN reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP or invalid input.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async resetPin(
    @Body(new ZodValidationPipe(resetPinSchema)) dto: ResetPinDto,
  ) {
    return this.authService.resetPin(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout User',
    description:
      'Logs out the user by revoking refresh tokens in the database. Optionally accepts a specific refresh token to revoke.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description:
            'The specific refresh token to revoke. If omitted, all active refresh tokens for the user will be revoked.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access token.',
  })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() body?: { refreshToken?: string },
  ) {
    return this.authService.logout(userId, body?.refreshToken);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Access Token',
    description:
      'Uses an active refresh token to issue a new access/refresh token pair.',
  })
  @ApiResponse({
    status: 200,
    description: 'New tokens issued successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is expired, revoked, or invalid.',
  })
  async refreshToken(
    @Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.authService.refreshToken(dto.refreshToken);
  }
}
