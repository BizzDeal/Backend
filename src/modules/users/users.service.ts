import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import { BusinessesService } from '../businesses/businesses.service';
import {
  UserRole,
  UserStatus,
  BusinessStatus,
  MediaPurpose,
  NotificationType,
} from '../../common/enums';
import { UpdateProfileDto, UserQueryDto } from './schemas/users.schema';
import { AnalyticsService } from '../analytics/analytics.service';
import { LocationService } from '../location/services/location.service';
import { RegionFilterDto } from '../../common/dto/region-filter.dto';
import { ChatService } from '../chat/chat.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

interface CreateUserData {
  email: string;
  phone?: string | null;
  pin_hash: string;
  role: UserRole;
  status: UserStatus;
  full_name?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  state_id?: string | null;
  district_id?: string | null;
  pincode?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    @InjectRepository(BusinessProfile)
    private readonly businessRepository: Repository<BusinessProfile>,
    private readonly auditService: AuditService,
    private readonly mediaService: MediaService,
    private readonly businessesService: BusinessesService,
    private readonly analyticsService: AnalyticsService,
    private readonly locationService: LocationService,
    private readonly chatService: ChatService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: UserQueryDto = {}) {
    const whereCondition: any = {};
    if (query.state) {
      whereCondition['profile.state_id'] = query.state;
    }
    if (query.district) {
      whereCondition['profile.district_id'] = query.district;
    }
    
    // Using query builder to handle nested where properly if needed, but find() with relations works too.
    const qb = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });
      
    if (query.state) {
      qb.andWhere('profile.state_id = :state', { state: query.state });
    }
    if (query.district) {
      qb.andWhere('profile.district_id = :district', { district: query.district });
    }
    if (query.search) {
      qb.andWhere(
        '(profile.full_name ILIKE :kw OR user.email ILIKE :kw OR user.phone ILIKE :kw OR profile.whatsapp ILIKE :kw)',
        { kw: `%${query.search}%` }
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [users, totalItems] = await qb.getManyAndCount();
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const profilePics = await this.mediaRepository.find({
      where: {
        uploaded_by_id: In(userIds),
        purpose: MediaPurpose.PROFILE_PIC,
      },
    });

    const profilePicMap = new Map<string, string>();
    profilePics.forEach((pic) => {
      if (pic.uploaded_by_id) {
        profilePicMap.set(pic.uploaded_by_id, pic.file_url);
      }
    });

    const data = users.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      return {
        ...userWithoutPin,
        full_name: user.profile?.full_name || null,
        whatsapp: user.profile?.whatsapp || null,
        address: user.profile?.address || null,
        state_id: user.profile?.state_id || null,
        district_id: user.profile?.district_id || null,
        profile_pic_url: profilePicMap.get(user.id) || null,
      };
    });

    return {
      success: true,
      message: 'Users fetched successfully',
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOneByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone }, relations: { profile: true } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: { profile: true } });
  }

  async findOneByPhoneWithPin(phone: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .addSelect('user.pin_hash')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  async findOneByEmailWithPin(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .addSelect('user.pin_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: {
        profile: {
          state: true,
          district: true,
        },
      },
    });
  }

  async create(userData: CreateUserData): Promise<User> {
    const user = this.usersRepository.create({
      email: userData.email,
      phone: userData.phone,
      pin_hash: userData.pin_hash,
      role: userData.role,
      status: userData.status,
    });
    const savedUser = await this.usersRepository.save(user);
    
    let fullName = userData.full_name?.trim();
    if (!fullName && userData.email && userData.email.includes('@')) {
      fullName = userData.email.split('@')[0];
    }

    // Create profile
    const profile = this.profileRepository.create({
      user_id: savedUser.id,
      full_name: fullName || null,
      whatsapp: userData.whatsapp,
      address: userData.address,
      state_id: userData.state_id,
      district_id: userData.district_id,
      pincode: userData.pincode || null,
    });
    const savedProfile = await this.profileRepository.save(profile);
    
    savedUser.profile = savedProfile;

    if (savedUser && savedUser.role) {
      await this.analyticsService.trackUserCreated(savedUser.role);
    }
    
    // Add user to the default Global Community chat group if they are active
    if (savedUser.status === UserStatus.ACTIVE) {
      await this.chatService.addUserToDefaultGroup(savedUser.id);
    }

    return savedUser;
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, updateData);
    const updatedUser = await this.findOneById(id);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async checkUserExist(email: string): Promise<{
    exists: boolean;
  }> {
    const user = await this.findOneByEmail(email);
    return { exists: !!user };
  }

  async findMembers(status?: UserStatus, query: UserQueryDto = {}) {
    const qb = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('profile.state', 'state')
      .leftJoinAndSelect('profile.district', 'district')
      .where('user.role = :role', { role: UserRole.MEMBER });
      
    if (status) {
      qb.andWhere('user.status = :status', { status });
    } else {
      qb.andWhere('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });
    }
    if (query.state) {
      qb.andWhere('profile.state_id = :state', { state: query.state });
    }
    if (query.district) {
      qb.andWhere('profile.district_id = :district', { district: query.district });
    }
    if (query.exclude_districts) {
      qb.andWhere('profile.district_id NOT IN (:...exclude_districts)', { exclude_districts: query.exclude_districts.split(',') });
    }
    if (query.search) {
      qb.andWhere(
        '(profile.full_name ILIKE :kw OR user.email ILIKE :kw OR user.phone ILIKE :kw OR profile.whatsapp ILIKE :kw)',
        { kw: `%${query.search}%` }
      );
    }

    qb.orderBy('user.created_at', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [members, totalItems] = await qb.getManyAndCount();

    if (members.length === 0) {
      return {
        success: true,
        message: 'Members fetched successfully',
        data: [],
        meta: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    }

    const memberIds = members.map((u) => u.id);
    const mediaFiles = await this.mediaRepository.find({
      where: {
        uploaded_by_id: In(memberIds),
        purpose: MediaPurpose.PROFILE_PIC,
      },
    });

    const businesses = await this.businessRepository.find({
      where: { owner_id: In(memberIds) },
    });

    const profilePicMap = new Map<string, string>();
    mediaFiles.forEach((m) => {
      if (m.uploaded_by_id) {
        if (m.purpose === MediaPurpose.PROFILE_PIC) {
          profilePicMap.set(m.uploaded_by_id, m.file_url);
        }
      }
    });

    const businessMap = new Map<string, BusinessProfile>();
    businesses.forEach((b) => {
      businessMap.set(b.owner_id, b);
    });

    const data = members.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      const b = businessMap.get(user.id);
      return {
        ...userWithoutPin,
        full_name: user.profile?.full_name || null,
        whatsapp: user.profile?.whatsapp || null,
        address: user.profile?.address || null,
        state_id: user.profile?.state_id || null,
        state_name: user.profile?.state?.name || null,
        district_id: user.profile?.district_id || null,
        district_name: user.profile?.district?.name || null,
        profile_pic_url: profilePicMap.get(user.id) || null,
        business_id: b?.id || null,
        businessProfile: b ? {
          business_name: b.name,
          description: b.description,
          category_id: b.category_id
        } : undefined
      };
    });

    return {
      success: true,
      message: 'Members fetched successfully',
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findCustomers(query: UserQueryDto = {}) {
    const qb = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('profile.state', 'state')
      .leftJoinAndSelect('profile.district', 'district')
      .leftJoinAndSelect('profile.primary_business', 'primary_business')
      .where('user.role = :role', { role: UserRole.CUSTOMER })
      .andWhere('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });

    if (query.state) {
      qb.andWhere('profile.state_id = :state', { state: query.state });
    }
    if (query.district) {
      qb.andWhere('profile.district_id = :district', { district: query.district });
    }
    if (query.search) {
      qb.andWhere(
        '(profile.full_name ILIKE :kw OR user.email ILIKE :kw OR user.phone ILIKE :kw OR profile.whatsapp ILIKE :kw)',
        { kw: `%${query.search}%` }
      );
    }
    
    qb.orderBy('user.created_at', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [customers, totalItems] = await qb.getManyAndCount();

    if (customers.length === 0) {
      return {
        success: true,
        message: 'Customers fetched successfully',
        data: [],
        meta: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    }

    const customerIds = customers.map((u) => u.id);
    const profilePics = await this.mediaRepository.find({
      where: {
        uploaded_by_id: In(customerIds),
        purpose: MediaPurpose.PROFILE_PIC,
      },
    });

    const profilePicMap = new Map<string, string>();
    profilePics.forEach((pic) => {
      if (pic.uploaded_by_id) {
        profilePicMap.set(pic.uploaded_by_id, pic.file_url);
      }
    });

    const data = customers.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      return {
        ...userWithoutPin,
        full_name: user.profile?.full_name || null,
        whatsapp: user.profile?.whatsapp || null,
        address: user.profile?.address || null,
        state_id: user.profile?.state_id || null,
        state_name: user.profile?.state?.name || null,
        district_id: user.profile?.district_id || null,
        district_name: user.profile?.district?.name || null,
        profile_pic_url: profilePicMap.get(user.id) || null,
        primary_business_store: user.profile?.primary_business ? {
          business_name: user.profile.primary_business.name,
          category_id: user.profile.primary_business.category_id
        } : null,
      };
    });

    return {
      success: true,
      message: 'Customers fetched successfully',
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  private calculateProfileCompletion(
    user: User,
    profilePicUrl: string | null,
    businessLogoUrl: string | null,
    business: BusinessProfile | null
  ) {
    let completion_score = 0;
    const missing_fields: string[] = [];
    const completed_fields: string[] = [];

    const hasFullName = user.profile?.full_name && user.profile.full_name !== 'Customer' && user.profile.full_name.trim().length >= 2;
    const hasPhone = !!user.phone && user.phone.trim().length >= 10;
    const hasEmail = !!user.email && !user.email.includes('@bizzdeal.com');
    const hasState = !!user.profile?.state_id;
    
    // Optional Fields
    const hasDistrict = !!user.profile?.district_id;
    const hasPincode = !!user.profile?.pincode && /^[1-9][0-9]{5}$/.test(user.profile.pincode);
    const hasAddress = !!user.profile?.address && user.profile.address !== 'Not Provided';
    const hasProfilePic = !!profilePicUrl;
    const hasWhatsapp = !!user.profile?.whatsapp && user.profile.whatsapp.trim().length >= 10;

    let isPass = false;

    if (user.role === UserRole.CUSTOMER) {
      const customerFields = [
        { name: 'full_name', has: hasFullName, mandatory: true },
        { name: 'phone', has: hasPhone, mandatory: true },
        { name: 'email', has: hasEmail, mandatory: true },
        { name: 'state_id', has: hasState, mandatory: true },
        { name: 'district_id', has: hasDistrict, mandatory: true },
        { name: 'pincode', has: hasPincode, mandatory: true },
        { name: 'address', has: hasAddress, mandatory: false },
        { name: 'profile_picture', has: hasProfilePic, mandatory: false },
        { name: 'whatsapp', has: hasWhatsapp, mandatory: false }
      ];

      let mandatoryPass = true;
      let scoreIncrement = 100 / customerFields.length;

      for (const field of customerFields) {
        if (field.has) {
          completed_fields.push(field.name);
          completion_score += scoreIncrement;
        } else if (field.mandatory) {
          missing_fields.push(field.name);
          mandatoryPass = false;
        }
      }

      completion_score = Math.min(Math.round(completion_score), 100);
      isPass = mandatoryPass;
    } else {
      // MEMBER
      const hasBusinessName = business?.name && business.name.trim().length >= 2;
      const hasCategory = !!business?.category_id;
      const hasBusinessState = !!business?.state_id;
      const hasBusinessDesc = business?.description && business.description.trim().length >= 5;
      
      // Optional Business Fields
      const hasBusinessDistrict = !!business?.district_id;
      const hasBusinessPincode = !!business?.pincode && /^[1-9][0-9]{5}$/.test(business.pincode);
      const hasBusinessAddress = !!business?.address;
      const hasLogo = !!businessLogoUrl;
      const hasWebsite = !!business?.website;
      const hasGst = !!business?.gst_number;

      const memberFields = [
        { name: 'full_name', has: hasFullName, mandatory: true },
        { name: 'phone', has: hasPhone, mandatory: true },
        { name: 'email', has: hasEmail, mandatory: true },
        { name: 'state_id', has: hasState, mandatory: true },
        { name: 'district_id', has: hasDistrict, mandatory: true },
        { name: 'pincode', has: hasPincode, mandatory: true },
        { name: 'business_name', has: hasBusinessName, mandatory: true },
        { name: 'category_id', has: hasCategory, mandatory: true },
        { name: 'business_state_id', has: hasBusinessState, mandatory: true },
        { name: 'business_district_id', has: hasBusinessDistrict, mandatory: true },
        { name: 'business_pincode', has: hasBusinessPincode, mandatory: true },
        { name: 'business_description', has: hasBusinessDesc, mandatory: true },
        { name: 'whatsapp', has: hasWhatsapp, mandatory: false },
        { name: 'address', has: hasAddress, mandatory: false },
        { name: 'profile_picture', has: hasProfilePic, mandatory: false },
        { name: 'business_address', has: hasBusinessAddress, mandatory: false },
        { name: 'business_logo', has: hasLogo, mandatory: false },
        { name: 'website', has: hasWebsite, mandatory: false },
        { name: 'gst_number', has: hasGst, mandatory: false },
      ];

      let mandatoryPass = true;
      let scoreIncrement = 100 / memberFields.length;

      for (const field of memberFields) {
        if (field.has) {
          completed_fields.push(field.name);
          completion_score += scoreIncrement;
        } else if (field.mandatory) {
          missing_fields.push(field.name);
          mandatoryPass = false;
        }
      }

      completion_score = Math.min(Math.round(completion_score), 100);
      isPass = mandatoryPass;
    }

    return {
      completion_score: Math.round(completion_score),
      grade: isPass ? 'PASS' : 'INCOMPLETE',
      is_profile_completed: isPass,
      missing_fields,
      completed_fields,
    };
  }

  private async buildUserProfileData(user: User) {
    const mediaFiles = await this.mediaRepository.find({
      where: {
        uploaded_by_id: user.id,
        purpose: In([
          MediaPurpose.PROFILE_PIC,
          MediaPurpose.BUSINESS_LOGO,
        ]),
      },
    });

    let profile_pic_url: string | null = null;
    let business_logo_url: string | null = null;

    mediaFiles.forEach((m) => {
      if (m.purpose === MediaPurpose.PROFILE_PIC) {
        profile_pic_url = m.file_url;
      } else if (m.purpose === MediaPurpose.BUSINESS_LOGO) {
        business_logo_url = m.file_url;
      }
    });

    let business: BusinessProfile | null = null;
    let primary_business_name: string | null = null;
    let primary_business_id: string | null = null;
    let primary_business_category_name: string | null = null;
    let primary_business_state_name: string | null = null;
    let primary_business_district_name: string | null = null;
    
    if (user.role === UserRole.MEMBER) {
      business = await this.businessRepository.findOne({
        where: { owner_id: user.id },
      });
      if (business?.logo_id && !business_logo_url) {
        const logoFile = await this.mediaRepository.findOne({
          where: { id: business.logo_id },
        });
        if (logoFile) business_logo_url = logoFile.file_url;
      }
    } else if (user.role === UserRole.CUSTOMER && user.profile?.primary_business_id) {
      const pb = await this.businessRepository.findOne({
        where: { id: user.profile.primary_business_id },
        relations: { category: true, state: true, district: true }
      });
      if (pb) {
        primary_business_name = pb.name;
        primary_business_id = pb.id;
        primary_business_category_name = pb.category?.name || null;
        primary_business_state_name = pb.state?.name || null;
        primary_business_district_name = pb.district?.name || null;
      }
    }

    const completionData = this.calculateProfileCompletion(user, profile_pic_url, business_logo_url, business);

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    return {
      ...userWithoutPin,
      ...completionData,
      full_name: user.profile?.full_name || null,
      whatsapp: user.profile?.whatsapp || null,
      address: user.profile?.address || null,
      state_id: user.profile?.state_id || null,
      state_name: user.profile?.state?.name || null,
      district_id: user.profile?.district_id || null,
      district_name: user.profile?.district?.name || null,
      pincode: user.profile?.pincode || null,
      profile_pic_url,
      business_id:
        user.role === UserRole.MEMBER ? business?.id || null : undefined,
      category_id:
        user.role === UserRole.MEMBER ? business?.category_id || null : undefined,
      business_name:
        user.role === UserRole.MEMBER ? business?.name || null : undefined,
      business_description:
        user.role === UserRole.MEMBER ? business?.description || null : undefined,
      website:
        user.role === UserRole.MEMBER ? business?.website || null : undefined,
      gst_number:
        user.role === UserRole.MEMBER ? business?.gst_number || null : undefined,
      business_logo_url:
        user.role === UserRole.MEMBER ? business_logo_url : undefined,
      business_address:
        user.role === UserRole.MEMBER ? business?.address || null : undefined,
      business_state_id:
        user.role === UserRole.MEMBER ? business?.state_id || null : undefined,
      business_district_id:
        user.role === UserRole.MEMBER ? business?.district_id || null : undefined,
      business_pincode:
        user.role === UserRole.MEMBER ? business?.pincode || null : undefined,
      is_featured:
        user.role === UserRole.MEMBER ? (business?.is_featured ?? false) : undefined,
      primary_business_name:
        user.role === UserRole.CUSTOMER ? primary_business_name : undefined,
      primary_business_id:
        user.role === UserRole.CUSTOMER ? primary_business_id : undefined,
      primary_business_category_name:
        user.role === UserRole.CUSTOMER ? primary_business_category_name : undefined,
      primary_business_state_name:
        user.role === UserRole.CUSTOMER ? primary_business_state_name : undefined,
      primary_business_district_name:
        user.role === UserRole.CUSTOMER ? primary_business_district_name : undefined,
    };
  }

  async getProfile(userId: string) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data = await this.buildUserProfileData(user);
    return {
      success: true,
      message: 'Profile fetched successfully',
      data,
    };
  }

  async getUserById(userId: string) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data = await this.buildUserProfileData(user);
    return {
      success: true,
      message: 'User details fetched successfully',
      data,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    files?: {
      profile_pic?: Express.Multer.File[];
      business_logo?: Express.Multer.File[];
    },
  ) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const cleanPhone = (dto.phone && typeof dto.phone === 'string' && dto.phone.trim() !== '') ? dto.phone.trim() : null;
    const cleanEmail = (dto.email && typeof dto.email === 'string' && dto.email.trim() !== '') ? dto.email.trim() : null;

    if (cleanPhone && cleanPhone !== user.phone) {
      const existingUser = await this.findOneByPhone(cleanPhone);
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(
          'Phone number is already registered to another account',
        );
      }
    }

    if (cleanEmail && cleanEmail !== user.email) {
      const existingEmailUser = await this.findOneByEmail(cleanEmail);
      if (existingEmailUser && existingEmailUser.id !== userId) {
        throw new ConflictException(
          'Email address is already registered to another account',
        );
      }
    }

    const updateUserData: Partial<User> = {};
    const updateProfileData: Partial<Profile> = {};
    
    if (dto.phone !== undefined) updateUserData.phone = cleanPhone;
    if (cleanEmail) updateUserData.email = cleanEmail;

    if (dto.full_name !== undefined) updateProfileData.full_name = dto.full_name;
    if (dto.whatsapp !== undefined) updateProfileData.whatsapp = dto.whatsapp;
    if (dto.address !== undefined) updateProfileData.address = dto.address;
    if (dto.pincode !== undefined) updateProfileData.pincode = dto.pincode;

    if (dto.state_id !== undefined) {
      if (dto.state_id && dto.state_id !== '') {
        const state = await this.locationService.getStateById(dto.state_id);
        if (!state) {
          throw new BadRequestException('Selected state ID does not exist');
        }
        updateProfileData.state_id = dto.state_id;
      } else {
        updateProfileData.state_id = null;
      }
    }

    if (dto.district_id !== undefined) {
      if (dto.district_id && dto.district_id !== '') {
        const district = await this.locationService.getDistrictById(dto.district_id);
        if (!district) {
          throw new BadRequestException('Selected district ID does not exist');
        }
        const checkStateId = updateProfileData.state_id !== undefined ? updateProfileData.state_id : user.profile?.state_id;
        if (checkStateId && district.stateId !== checkStateId) {
          throw new BadRequestException('Selected district does not belong to the selected state');
        }
        updateProfileData.district_id = dto.district_id;
      } else {
        updateProfileData.district_id = null;
      }
    }

    if (Object.keys(updateUserData).length > 0) {
      await this.usersRepository.update(userId, updateUserData);
    }
    
    if (Object.keys(updateProfileData).length > 0) {
      if (user.profile) {
        await this.profileRepository.update(user.profile.id, updateProfileData);
      } else {
        const profile = this.profileRepository.create({ ...updateProfileData, user_id: userId });
        await this.profileRepository.save(profile);
      }
    }

    if (files?.profile_pic?.[0]) {
      await this.mediaService.replaceUserFile(
        files.profile_pic[0],
        userId,
        MediaPurpose.PROFILE_PIC,
      );
    }

    if (user.role === UserRole.MEMBER) {
      const business = await this.businessRepository.findOne({
        where: { owner_id: userId },
      });

      if (business) {
        if (dto.category_id && dto.category_id !== business.category_id) {
          const category = await this.businessesService.validateCategoryExists(
            dto.category_id,
          );
          if (!category) {
            throw new BadRequestException(
              'Selected business category ID does not exist or is inactive',
            );
          }
        }

        const businessUpdate: Partial<BusinessProfile> = {};
        if (dto.category_id !== undefined)
          businessUpdate.category_id = dto.category_id;
        if (dto.business_name !== undefined)
          businessUpdate.name = dto.business_name;
        if (dto.business_description !== undefined)
          businessUpdate.description = dto.business_description;
        if (dto.website !== undefined) businessUpdate.website = dto.website;
        if (dto.gst_number !== undefined)
          businessUpdate.gst_number = dto.gst_number;
        
        if (dto.business_address !== undefined)
          businessUpdate.address = dto.business_address;
        
        if (dto.business_state_id !== undefined) {
          if (dto.business_state_id && dto.business_state_id !== '') {
            const state = await this.locationService.getStateById(dto.business_state_id);
            if (!state) throw new BadRequestException('Selected business state ID does not exist');
            businessUpdate.state_id = dto.business_state_id;
          } else {
            businessUpdate.state_id = null;
          }
        }

        if (dto.business_district_id !== undefined) {
          if (dto.business_district_id && dto.business_district_id !== '') {
            const district = await this.locationService.getDistrictById(dto.business_district_id);
            if (!district) throw new BadRequestException('Selected business district ID does not exist');
            const checkStateId = businessUpdate.state_id !== undefined ? businessUpdate.state_id : business.state_id;
            if (checkStateId && district.stateId !== checkStateId) {
              throw new BadRequestException('Selected business district does not belong to the selected business state');
            }
            businessUpdate.district_id = dto.business_district_id;
          } else {
            businessUpdate.district_id = null;
          }
        }

        if (dto.business_pincode !== undefined) {
          businessUpdate.pincode = dto.business_pincode;
        }

        if (files?.business_logo?.[0]) {
          const logoMedia = await this.mediaService.replaceUserFile(
            files.business_logo[0],
            userId,
            MediaPurpose.BUSINESS_LOGO,
          );
          businessUpdate.logo_id = logoMedia.id;
        }

        if (Object.keys(businessUpdate).length > 0) {
          await this.businessRepository.update(business.id, businessUpdate);
        }
      }
    }

    return this.getProfile(userId);
  }

  private async validateAdminRole(adminId?: string, targetUserId?: string) {
    if (!adminId) return;
    if (targetUserId && adminId === targetUserId) {
      throw new ForbiddenException(
        'Admin cannot perform administrative actions on their own account',
      );
    }
    const adminUser = await this.findOneById(adminId);
    if (!adminUser) {
      throw new NotFoundException('Specified admin user not found');
    }
    if (adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Specified adminId does not have ADMIN role',
      );
    }
  }

  async approveMember(memberId: string, adminId?: string, ipAddress?: string) {
    await this.validateAdminRole(adminId, memberId);
    const user = await this.findOneById(memberId);
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    if (user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Specified user is not a member');
    }

    const oldStatus = user.status;
    await this.usersRepository.update(memberId, {
      status: UserStatus.ACTIVE,
      approved_by_id: adminId ?? null,
      approved_at: new Date(),
    });

    await this.businessRepository.update(
      { owner_id: memberId },
      { status: BusinessStatus.ACTIVE },
    );

    await this.auditService.createLog({
      user_id: adminId ?? null,
      action: 'MEMBER_APPROVAL',
      entity_type: 'User',
      entity_id: memberId,
      old_data: { status: oldStatus },
      new_data: { status: UserStatus.ACTIVE },
      ip_address: ipAddress,
    });

    if (oldStatus !== UserStatus.ACTIVE) {
      await this.analyticsService.trackMemberApproved();
    }
    
    // Add the newly approved member to the default group
    await this.chatService.addUserToDefaultGroup(memberId);

    // Send Notification and Email
    if (oldStatus !== UserStatus.ACTIVE) {
      await this.notificationsService.create({
        user_id: memberId,
        title: 'Member Account Approved',
        message: 'Your BizzDeal member account has been approved and is now active.',
        type: NotificationType.GENERAL,
      });
      await this.mailService.sendMemberStatusEmail(user.email, UserStatus.ACTIVE);
    }

    return {
      success: true,
      message: 'Member approved successfully',
      data: { memberId, status: UserStatus.ACTIVE },
    };
  }

  async rejectMember(memberId: string, adminId?: string, ipAddress?: string) {
    await this.validateAdminRole(adminId, memberId);
    const user = await this.findOneById(memberId);
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    if (user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Specified user is not a member');
    }

    const oldStatus = user.status;
    await this.usersRepository.update(memberId, {
      status: UserStatus.REJECTED,
    });

    await this.businessRepository.update(
      { owner_id: memberId },
      { status: BusinessStatus.REJECTED },
    );

    await this.auditService.createLog({
      user_id: adminId ?? null,
      action: 'MEMBER_REJECTION',
      entity_type: 'User',
      entity_id: memberId,
      old_data: { status: oldStatus },
      new_data: { status: UserStatus.REJECTED },
      ip_address: ipAddress,
    });

    if (oldStatus === UserStatus.ACTIVE) {
      await this.analyticsService.trackMemberRejectedOrSuspended();
    }

    // Send Notification and Email
    await this.notificationsService.create({
      user_id: memberId,
      title: 'Member Account Update',
      message: 'We regret to inform you that your BizzDeal member account application has been rejected.',
      type: NotificationType.GENERAL,
    });
    await this.mailService.sendMemberStatusEmail(user.email, UserStatus.REJECTED);

    return {
      success: true,
      message: 'Member rejected successfully',
      data: { memberId, status: UserStatus.REJECTED },
    };
  }

  async suspendMember(memberId: string, adminId?: string, ipAddress?: string) {
    await this.validateAdminRole(adminId, memberId);
    const user = await this.findOneById(memberId);
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    if (user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Specified user is not a member');
    }

    const oldStatus = user.status;
    await this.usersRepository.update(memberId, {
      status: UserStatus.SUSPENDED,
    });

    await this.businessRepository.update(
      { owner_id: memberId },
      { status: BusinessStatus.SUSPENDED },
    );

    await this.auditService.createLog({
      user_id: adminId ?? null,
      action: 'MEMBER_SUSPENSION',
      entity_type: 'User',
      entity_id: memberId,
      old_data: { status: oldStatus },
      new_data: { status: UserStatus.SUSPENDED },
      ip_address: ipAddress,
    });

    if (oldStatus === UserStatus.ACTIVE) {
      await this.analyticsService.trackMemberRejectedOrSuspended();
    }

    // Send Notification and Email
    await this.notificationsService.create({
      user_id: memberId,
      title: 'Member Account Suspended',
      message: 'Your BizzDeal member account has been suspended.',
      type: NotificationType.GENERAL,
    });
    await this.mailService.sendMemberStatusEmail(user.email, UserStatus.SUSPENDED);

    return {
      success: true,
      message: 'Member suspended successfully',
      data: { memberId, status: UserStatus.SUSPENDED },
    };
  }

  async deleteMember(memberId: string, adminId?: string, ipAddress?: string) {
    await this.validateAdminRole(adminId, memberId);
    const user = await this.findOneById(memberId);
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    if (user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Specified user is not a member');
    }

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    await this.usersRepository.delete(memberId);
    // Note: Due to CASCADE onDelete on Profile and BusinessProfile in entities, they should be deleted automatically.

    await this.auditService.createLog({
      user_id: adminId ?? null,
      action: 'MEMBER_DELETION',
      entity_type: 'User',
      entity_id: memberId,
      old_data: userWithoutPin,
      ip_address: ipAddress,
    });

    return {
      success: true,
      message: 'Member deleted successfully',
    };
  }
}
