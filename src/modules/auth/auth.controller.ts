import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  loginSchema,
  registerMemberSchema,
  registerCustomerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPinSchema,
  resetPinSchema,
  refreshTokenSchema,
  LoginDto,
  RegisterMemberDto,
  RegisterCustomerDto,
  SendOtpDto,
  VerifyOtpDto,
  ForgotPinDto,
  ResetPinDto,
  RefreshTokenDto,
} from './schemas/auth.schema';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User Login',
    description: 'Authenticates a user via phone and security PIN, returning access/refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns access token, refresh token, and user profile details.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account is suspended/rejected.',
  })
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register-member')
  @ApiOperation({
    summary: 'Register Member / Entrepreneur',
    description: 'Registers a new member account. Requires pre-verification of the phone number via OTP. Status is set to PENDING until approved by an admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Member registered successfully. Returns initial session tokens and profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or phone number is not pre-verified via OTP.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already registered.',
  })
  async registerMember(
    @Body(new ZodValidationPipe(registerMemberSchema)) dto: RegisterMemberDto,
  ) {
    return this.authService.registerMember(dto);
  }

  @Post('register-customer')
  @ApiOperation({
    summary: 'Register Customer',
    description: 'Registers a new customer account. Requires pre-verification of the phone number via OTP. Customer is immediately active.',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer registered successfully. Returns initial session tokens and profile.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or phone number is not pre-verified via OTP.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already registered.',
  })
  async registerCustomer(
    @Body(new ZodValidationPipe(registerCustomerSchema)) dto: RegisterCustomerDto,
  ) {
    return this.authService.registerCustomer(dto);
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP',
    description: 'Generates and sends a 6-digit OTP code to the destination phone number via MSG91.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP code generated and sent successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or MSG91 transmission failed.',
  })
  async sendOtp(@Body(new ZodValidationPipe(sendOtpSchema)) dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verifies the OTP code received by the user against the latest requested OTP for the phone and purpose.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'OTP has expired, is invalid, or no matching request was found.',
  })
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto,
  ) {
    return this.authService.verifyOtp(dto);
  }

  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forgot PIN',
    description: 'Triggers the recovery flow for a forgotten PIN by sending an OTP to the registered phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery OTP sent successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Phone number not found in registered users.',
  })
  async forgotPin(
    @Body(new ZodValidationPipe(forgotPinSchema)) dto: ForgotPinDto,
  ) {
    return this.authService.forgotPin(dto.phone);
  }

  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset PIN',
    description: 'Resets the security PIN of a user after verifying the recovery OTP.',
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
    description: 'Logs out the user by revoking refresh tokens in the database. Optionally accepts a specific refresh token to revoke.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'The specific refresh token to revoke. If omitted, all active refresh tokens for the user will be revoked.',
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
    description: 'Uses an active refresh token to issue a new access/refresh token pair.',
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
