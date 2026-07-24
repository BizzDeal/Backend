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
    if (query.states) {
      whereCondition['profile.state_id'] = In(query.states.split(','));
    }
    if (query.districts) {
      whereCondition['profile.district_id'] = In(query.districts.split(','));
    }
    
    // Using query builder to handle nested where properly if needed, but find() with relations works too.
    const qb = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });
      
    if (query.states) {
      qb.andWhere('profile.state_id IN (:...states)', { states: query.states.split(',') });
    }
    if (query.districts) {
      qb.andWhere('profile.district_id IN (:...districts)', { districts: query.districts.split(',') });
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
    return this.usersRepository.findOne({ where: { id }, relations: { profile: true } });
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
    
    // Create profile
    const profile = this.profileRepository.create({
      user_id: savedUser.id,
      full_name: userData.full_name,
      whatsapp: userData.whatsapp,
      address: userData.address,
      state_id: userData.state_id,
      district_id: userData.district_id,
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
      .where('user.role = :role', { role: UserRole.MEMBER });
      
    if (status) {
      qb.andWhere('user.status = :status', { status });
    } else {
      qb.andWhere('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });
    }
    if (query.states) {
      qb.andWhere('profile.state_id IN (:...states)', { states: query.states.split(',') });
    }
    if (query.districts) {
      qb.andWhere('profile.district_id IN (:...districts)', { districts: query.districts.split(',') });
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
        purpose: In([MediaPurpose.PROFILE_PIC, MediaPurpose.PAYMENT_RECEIPT]),
      },
    });

    const businesses = await this.businessRepository.find({
      where: { owner_id: In(memberIds) },
    });

    const profilePicMap = new Map<string, string>();
    const receiptMap = new Map<string, string>();
    mediaFiles.forEach((m) => {
      if (m.uploaded_by_id) {
        if (m.purpose === MediaPurpose.PROFILE_PIC) {
          profilePicMap.set(m.uploaded_by_id, m.file_url);
        } else if (m.purpose === MediaPurpose.PAYMENT_RECEIPT) {
          receiptMap.set(m.uploaded_by_id, m.file_url);
        }
      }
    });

    const businessMap = new Map<string, BusinessProfile>();
    businesses.forEach((b) => {
      businessMap.set(b.owner_id, b);
    });

    const data = members.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      return {
        ...userWithoutPin,
        full_name: user.profile?.full_name || null,
        whatsapp: user.profile?.whatsapp || null,
        address: user.profile?.address || null,
        state_id: user.profile?.state_id || null,
        district_id: user.profile?.district_id || null,
        profile_pic_url: profilePicMap.get(user.id) || null,
        payment_receipt_url: receiptMap.get(user.id) || null,
        business_id: businessMap.get(user.id)?.id || null,
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
      .where('user.role = :role', { role: UserRole.CUSTOMER })
      .andWhere('user.status != :unverifiedStatus', { unverifiedStatus: UserStatus.UNVERIFIED });

    if (query.states) {
      qb.andWhere('profile.state_id IN (:...states)', { states: query.states.split(',') });
    }
    if (query.districts) {
      qb.andWhere('profile.district_id IN (:...districts)', { districts: query.districts.split(',') });
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
        district_id: user.profile?.district_id || null,
        profile_pic_url: profilePicMap.get(user.id) || null,
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

  private async buildUserProfileData(user: User) {
    const mediaFiles = await this.mediaRepository.find({
      where: {
        uploaded_by_id: user.id,
        purpose: In([
          MediaPurpose.PROFILE_PIC,
          MediaPurpose.PAYMENT_RECEIPT,
          MediaPurpose.BUSINESS_LOGO,
        ]),
      },
    });

    let profile_pic_url: string | null = null;
    let payment_receipt_url: string | null = null;
    let business_logo_url: string | null = null;

    mediaFiles.forEach((m) => {
      if (m.purpose === MediaPurpose.PROFILE_PIC) {
        profile_pic_url = m.file_url;
      } else if (m.purpose === MediaPurpose.PAYMENT_RECEIPT) {
        payment_receipt_url = m.file_url;
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

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    return {
      ...userWithoutPin,
      full_name: user.profile?.full_name || null,
      whatsapp: user.profile?.whatsapp || null,
      address: user.profile?.address || null,
      state_id: user.profile?.state_id || null,
      district_id: user.profile?.district_id || null,
      profile_pic_url,
      payment_receipt_url:
        user.role === UserRole.MEMBER ? payment_receipt_url : undefined,
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

    if (dto.phone && dto.phone !== user.phone) {
      const existingUser = await this.findOneByPhone(dto.phone);
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(
          'Phone number is already registered to another account',
        );
      }
    }

    const updateUserData: Partial<User> = {};
    const updateProfileData: Partial<Profile> = {};
    
    if (dto.phone !== undefined) updateUserData.phone = dto.phone;
    if (dto.email !== undefined) updateUserData.email = dto.email;

    if (dto.full_name !== undefined) updateProfileData.full_name = dto.full_name;
    if (dto.whatsapp !== undefined) updateProfileData.whatsapp = dto.whatsapp;
    if (dto.address !== undefined) updateProfileData.address = dto.address;

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
