import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { OtpRequest } from './entities/otp-request.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { Msg91Service } from './services/msg91.service';
import { OtpPurpose, OtpProvider, UserRole, UserStatus } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import {
  LoginDto,
  RegisterMemberDto,
  RegisterCustomerDto,
  SendOtpDto,
  VerifyOtpDto,
  ResetPinDto,
} from './schemas/auth.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OtpRequest)
    private readonly otpRepository: Repository<OtpRequest>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly msg91Service: Msg91Service,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN as any) || '1h',
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'bizz_deal_refresh_secret',
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d',
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days

    const refreshTokenEntity = this.refreshTokenRepository.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'pin_hash'> }> {
    const user = await this.usersService.findOneByPhone(dto.phone);
    if (!user) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Your registration request was rejected.');
    }

    const isPinValid = await bcrypt.compare(dto.pin, user.pin_hash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    const tokens = await this.generateTokens(user);

    // Update last login timestamp
    await this.usersService.update(user.id, { last_login_at: new Date() });

    const { pin_hash, ...userWithoutPin } = user;
    return {
      ...tokens,
      user: {
        ...userWithoutPin,
        last_login_at: new Date(),
      },
    };
  }

  async registerMember(dto: RegisterMemberDto): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'pin_hash'> }> {
    // Check if phone number is already registered
    const existingUser = await this.usersService.findOneByPhone(dto.phone);
    if (existingUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Verify OTP was verified for registration
    await this.verifyOtpRegistrationPrerequisite(dto.phone);

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const newUser = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email || null,
      pin_hash: pinHash,
      role: UserRole.MEMBER,
      status: UserStatus.PENDING, // Members are pending by default until Admin approves
    });

    const tokens = await this.generateTokens(newUser);

    const { pin_hash, ...userWithoutPin } = newUser;
    return {
      ...tokens,
      user: userWithoutPin,
    };
  }

  async registerCustomer(dto: RegisterCustomerDto): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'pin_hash'> }> {
    // Check if phone number is already registered
    const existingUser = await this.usersService.findOneByPhone(dto.phone);
    if (existingUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Verify OTP was verified for registration
    await this.verifyOtpRegistrationPrerequisite(dto.phone);

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const newUser = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email || null,
      pin_hash: pinHash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE, // Customers are active by default
    });

    const tokens = await this.generateTokens(newUser);

    const { pin_hash, ...userWithoutPin } = newUser;
    return {
      ...tokens,
      user: userWithoutPin,
    };
  }

  private async verifyOtpRegistrationPrerequisite(phone: string): Promise<void> {
    const verifiedRequest = await this.otpRepository.findOne({
      where: {
        phone,
        purpose: OtpPurpose.REGISTER,
        is_verified: true,
      },
      order: { verified_at: 'DESC' },
    });

    if (!verifiedRequest || !verifiedRequest.verified_at) {
      throw new BadRequestException('Phone number must be verified via OTP first');
    }

    // Ensure verified request is within last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (verifiedRequest.verified_at < fifteenMinutesAgo) {
      throw new BadRequestException('OTP verification has expired. Please verify again.');
    }
  }

  async sendOtp(dto: SendOtpDto): Promise<{ success: boolean; message: string }> {
    // Generate a random 6 digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Expires in 5 minutes

    // Create OTP request record
    const otpRequest = this.otpRepository.create({
      phone: dto.phone,
      purpose: dto.purpose,
      provider: OtpProvider.MSG91,
      is_verified: false,
      expires_at: expiresAt,
    });

    const result = await this.msg91Service.sendOtp(dto.phone, otp);

    if (result.success) {
      // Store the OTP code itself or MSG91 response id
      otpRequest.provider_request_id = result.requestId || otp;
      await this.otpRepository.save(otpRequest);
      return { success: true, message: result.message || 'OTP sent successfully' };
    }

    throw new BadRequestException('Failed to send OTP. Please try again.');
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ success: boolean; message: string }> {
    // Find latest active OTP request for phone and purpose
    const otpRequest = await this.otpRepository.findOne({
      where: {
        phone: dto.phone,
        purpose: dto.purpose,
        is_verified: false,
        expires_at: LessThan(new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)), // dummy placeholder to allow order by
      },
      order: { created_at: 'DESC' },
    });

    if (!otpRequest || otpRequest.expires_at < new Date()) {
      throw new BadRequestException('OTP has expired or no request was found');
    }

    // Call MSG91 to verify
    const isVerified = await this.msg91Service.verifyOtp(dto.phone, dto.otp);

    if (!isVerified) {
      throw new BadRequestException('Invalid OTP code');
    }

    otpRequest.is_verified = true;
    otpRequest.verified_at = new Date();
    await this.otpRepository.save(otpRequest);

    return { success: true, message: 'OTP verified successfully' };
  }

  async forgotPin(phone: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOneByPhone(phone);
    if (!user) {
      throw new NotFoundException('User with this phone number was not found');
    }

    return this.sendOtp({ phone, purpose: OtpPurpose.FORGOT_PIN });
  }

  async resetPin(dto: ResetPinDto): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOneByPhone(dto.phone);
    if (!user) {
      throw new NotFoundException('User with this phone number was not found');
    }

    // Verify OTP first
    await this.verifyOtp({
      phone: dto.phone,
      otp: dto.otp,
      purpose: OtpPurpose.FORGOT_PIN,
    });

    const newPinHash = await bcrypt.hash(dto.newPin, 10);
    await this.usersService.update(user.id, { pin_hash: newPinHash });

    return { success: true, message: 'PIN reset successfully' };
  }

  async logout(userId: string, refreshToken?: string): Promise<{ success: boolean; message: string }> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.refreshTokenRepository.update(
        { user_id: userId, token_hash: tokenHash },
        { revoked_at: new Date() },
      );
    } else {
      // Revoke all refresh tokens for this user
      await this.refreshTokenRepository.update(
        { user_id: userId },
        { revoked_at: new Date() },
      );
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'bizz_deal_refresh_secret',
      });

      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.refreshTokenRepository.findOne({
        where: {
          user_id: payload.sub,
          token_hash: tokenHash,
        },
      });

      if (!storedToken || storedToken.revoked_at || storedToken.expires_at < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.usersService.findOneById(payload.sub);
      if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.REJECTED) {
        throw new UnauthorizedException('User account is inactive or not found');
      }

      // Revoke old token
      storedToken.revoked_at = new Date();
      await this.refreshTokenRepository.save(storedToken);

      // Generate new pair
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
