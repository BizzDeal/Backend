import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { BusinessesService } from '../businesses/businesses.service';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { MediaService } from '../media/media.service';
import { LocationService } from '../location/services/location.service';
import {
  UserRole,
  UserStatus,
  BusinessStatus,
  MediaPurpose,
} from '../../common/enums';
import { User } from '../users/entities/user.entity';
import {
  LoginDto,
  RegisterMemberDto,
  RegisterCustomerDto,
  RegisterAdminDto,
  ResetPinDto,
} from './schemas/auth.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly firebaseService: FirebaseService,
    private readonly jwtService: JwtService,
    private readonly mediaService: MediaService,
    private readonly locationService: LocationService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async verifyPhoneMatch(
    inputPhone: string,
    firebaseToken: string,
  ): Promise<void> {
    const verifiedPhone =
      await this.firebaseService.verifyPhoneToken(firebaseToken);
    const cleanInput = inputPhone.replace(/\D/g, '');
    const cleanVerified = verifiedPhone.replace(/\D/g, '');

    if (
      !cleanVerified.endsWith(cleanInput) &&
      !cleanInput.endsWith(cleanVerified)
    ) {
      throw new BadRequestException(
        'Verified phone number does not match input phone number',
      );
    }
  }

  async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      name: user.full_name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ||
        '1h') as unknown as number,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'bizz_deal_refresh_secret',
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ||
          '7d') as unknown as number,
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

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'pin_hash'>;
  }> {
    const user = await this.usersService.findOneByPhoneWithPin(dto.phone);
    if (!user || !user.pin_hash) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException(
        'Your registration request was rejected.',
      );
    }

    const isPinValid = await bcrypt.compare(dto.pin, user.pin_hash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }

    const tokens = await this.generateTokens(user);

    // Update last login timestamp
    await this.usersService.update(user.id, { last_login_at: new Date() });

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    return {
      ...tokens,
      user: {
        ...userWithoutPin,
        last_login_at: new Date(),
      },
    };
  }

  async registerMember(
    dto: RegisterMemberDto,
    files?: {
      profile_pic?: Express.Multer.File[];
      payment_receipt?: Express.Multer.File[];
      business_logo?: Express.Multer.File[];
    },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'pin_hash'>;
  }> {
    if (!files?.payment_receipt?.[0]) {
      throw new BadRequestException(
        'Payment receipt file is mandatory for member registration',
      );
    }

    // Check if phone number is already registered
    const existingUser = await this.usersService.findOneByPhone(dto.phone);
    if (existingUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Validate that the mandatory business category ID exists and is active
    const category = await this.businessesService.validateCategoryExists(
      dto.category_id,
    );
    if (!category) {
      throw new BadRequestException(
        'Selected business category ID does not exist or is inactive',
      );
    }

    // Validate State and District existence and mapping
    const state = await this.locationService.getStateById(dto.state_id);
    if (!state) {
      throw new BadRequestException('Selected state ID does not exist');
    }

    const district = await this.locationService.getDistrictById(
      dto.district_id,
    );
    if (!district) {
      throw new BadRequestException('Selected district ID does not exist');
    }

    if (district.stateId !== dto.state_id) {
      throw new BadRequestException(
        'Selected district does not belong to the selected state',
      );
    }

    // Verify phone token via Firebase Auth
    await this.verifyPhoneMatch(dto.phone, dto.firebaseToken);

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const newUser = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      address: dto.address,
      state_id: dto.state_id,
      district_id: dto.district_id,
      pin_hash: pinHash,
      role: UserRole.MEMBER,
      status: UserStatus.PENDING, // Members are pending by default until Admin approves
    });

    let logoId: string | null = null;
    if (files?.business_logo?.[0]) {
      const logoMedia = await this.mediaService.saveFile(
        files.business_logo[0],
        newUser.id,
        MediaPurpose.BUSINESS_LOGO,
      );
      logoId = logoMedia.id;
    }

    // Save the business profile details
    await this.businessesService.createBusiness({
      owner_id: newUser.id,
      category_id: dto.category_id,
      name: dto.business_name,
      description: dto.business_description,
      website: dto.website,
      gst_number: dto.gst_number,
      logo_id: logoId,
      status: BusinessStatus.PENDING,
    });

    if (files?.profile_pic?.[0]) {
      await this.mediaService.saveFile(
        files.profile_pic[0],
        newUser.id,
        MediaPurpose.PROFILE_PIC,
      );
    }

    await this.mediaService.saveFile(
      files.payment_receipt[0],
      newUser.id,
      MediaPurpose.PAYMENT_RECEIPT,
    );

    const tokens = await this.generateTokens(newUser);

    const { pin_hash: _pin_hash, ...userWithoutPin } = newUser;
    return {
      ...tokens,
      user: userWithoutPin,
    };
  }

  async registerCustomer(
    dto: RegisterCustomerDto,
    profile_image?: Express.Multer.File,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'pin_hash'>;
  }> {
    // Check if phone number is already registered
    const existingUser = await this.usersService.findOneByPhone(dto.phone);
    if (existingUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Verify phone token via Firebase Auth
    await this.verifyPhoneMatch(dto.phone, dto.firebaseToken);

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const newUser = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      address: dto.address,
      pin_hash: pinHash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE, // Customers are active by default
    });

    if (profile_image) {
      await this.mediaService.saveFile(
        profile_image,
        newUser.id,
        MediaPurpose.PROFILE_PIC,
      );
    }

    const tokens = await this.generateTokens(newUser);

    const { pin_hash: _pin_hash, ...userWithoutPin } = newUser;
    return {
      ...tokens,
      user: userWithoutPin,
    };
  }

  async registerAdmin(
    dto: RegisterAdminDto,
    profile_image?: Express.Multer.File,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'pin_hash'>;
  }> {
    // Check if phone number is already registered
    const existingUser = await this.usersService.findOneByPhone(dto.phone);
    if (existingUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Verify phone token via Firebase Auth
    await this.verifyPhoneMatch(dto.phone, dto.firebaseToken);

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const newUser = await this.usersService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      address: dto.address,
      pin_hash: pinHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE, // Admins are active by default
    });

    if (profile_image) {
      await this.mediaService.saveFile(
        profile_image,
        newUser.id,
        MediaPurpose.PROFILE_PIC,
      );
    }

    const tokens = await this.generateTokens(newUser);

    const { pin_hash: _pin_hash, ...userWithoutPin } = newUser;
    return {
      ...tokens,
      user: userWithoutPin,
    };
  }

  async forgotPin(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOneByPhone(phone);
    if (!user) {
      throw new NotFoundException('User with this phone number was not found');
    }

    return {
      success: true,
      message: 'User found. Please proceed with client-side OTP verification.',
    };
  }

  async resetPin(
    dto: ResetPinDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOneByPhone(dto.phone);
    if (!user) {
      throw new NotFoundException('User with this phone number was not found');
    }

    // Verify phone token via Firebase Auth
    await this.verifyPhoneMatch(dto.phone, dto.firebaseToken);

    const newPinHash = await bcrypt.hash(dto.newPin, 10);
    await this.usersService.update(user.id, { pin_hash: newPinHash });

    return { success: true, message: 'PIN reset successfully' };
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ success: boolean; message: string }> {
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

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

      if (
        !storedToken ||
        storedToken.revoked_at ||
        storedToken.expires_at < new Date()
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.usersService.findOneById(payload.sub);
      if (
        !user ||
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.REJECTED
      ) {
        throw new UnauthorizedException(
          'User account is inactive or not found',
        );
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
