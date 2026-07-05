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
import { MediaFile } from '../media/entities/media-file.entity';
import { Business } from '../businesses/entities/business.entity';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import { BusinessesService } from '../businesses/businesses.service';
import {
  UserRole,
  UserStatus,
  BusinessStatus,
  MediaPurpose,
} from '../../common/enums';
import { UpdateProfileDto } from './schemas/users.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly auditService: AuditService,
    private readonly mediaService: MediaService,
    private readonly businessesService: BusinessesService,
  ) {}

  async findAll(): Promise<
    (Omit<User, 'pin_hash'> & { profile_pic_url: string | null })[]
  > {
    const users = await this.usersRepository.find();
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

    return users.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      return {
        ...userWithoutPin,
        profile_pic_url: profilePicMap.get(user.id) || null,
      };
    });
  }

  async findOneByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async findOneByPhoneWithPin(phone: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.pin_hash')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, updateData);
    const updatedUser = await this.findOneById(id);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    return updatedUser;
  }

  async checkUserExist(phone: string): Promise<{
    exists: boolean;
  }> {
    const user = await this.findOneByPhone(phone);
    return { exists: !!user };
  }

  async findMembers() {
    const members = await this.usersRepository.find({
      where: { role: UserRole.MEMBER },
      order: { created_at: 'DESC' },
    });

    if (members.length === 0) {
      return {
        success: true,
        message: 'Members fetched successfully',
        data: [],
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

    const businessMap = new Map<string, Business>();
    businesses.forEach((b) => {
      businessMap.set(b.owner_id, b);
    });

    const data = members.map((user) => {
      const { pin_hash: _pin_hash, ...userWithoutPin } = user;
      return {
        ...userWithoutPin,
        profile_pic_url: profilePicMap.get(user.id) || null,
        payment_receipt_url: receiptMap.get(user.id) || null,
        business_id: businessMap.get(user.id)?.id || null,
      };
    });

    return {
      success: true,
      message: 'Members fetched successfully',
      data,
    };
  }

  async findCustomers() {
    const customers = await this.usersRepository.find({
      where: { role: UserRole.CUSTOMER },
      order: { created_at: 'DESC' },
    });

    if (customers.length === 0) {
      return {
        success: true,
        message: 'Customers fetched successfully',
        data: [],
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
        profile_pic_url: profilePicMap.get(user.id) || null,
      };
    });

    return {
      success: true,
      message: 'Customers fetched successfully',
      data,
    };
  }

  async getProfile(userId: string) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mediaFiles = await this.mediaRepository.find({
      where: {
        uploaded_by_id: userId,
        purpose: In([MediaPurpose.PROFILE_PIC, MediaPurpose.PAYMENT_RECEIPT]),
      },
    });

    let profile_pic_url: string | null = null;
    let payment_receipt_url: string | null = null;

    mediaFiles.forEach((m) => {
      if (m.purpose === MediaPurpose.PROFILE_PIC) {
        profile_pic_url = m.file_url;
      } else if (m.purpose === MediaPurpose.PAYMENT_RECEIPT) {
        payment_receipt_url = m.file_url;
      }
    });

    let business: Business | null = null;
    if (user.role === UserRole.MEMBER) {
      business = await this.businessRepository.findOne({
        where: { owner_id: userId },
      });
    }

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    return {
      success: true,
      message: 'Profile fetched successfully',
      data: {
        ...userWithoutPin,
        profile_pic_url,
        payment_receipt_url:
          user.role === UserRole.MEMBER ? payment_receipt_url : undefined,
        business_id:
          user.role === UserRole.MEMBER ? business?.id || null : undefined,
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mediaFiles = await this.mediaRepository.find({
      where: {
        uploaded_by_id: userId,
        purpose: In([MediaPurpose.PROFILE_PIC, MediaPurpose.PAYMENT_RECEIPT]),
      },
    });

    let profile_pic_url: string | null = null;
    let payment_receipt_url: string | null = null;

    mediaFiles.forEach((m) => {
      if (m.purpose === MediaPurpose.PROFILE_PIC) {
        profile_pic_url = m.file_url;
      } else if (m.purpose === MediaPurpose.PAYMENT_RECEIPT) {
        payment_receipt_url = m.file_url;
      }
    });

    let business: Business | null = null;
    if (user.role === UserRole.MEMBER) {
      business = await this.businessRepository.findOne({
        where: { owner_id: userId },
      });
    }

    const { pin_hash: _pin_hash, ...userWithoutPin } = user;
    return {
      success: true,
      message: 'User details fetched successfully',
      data: {
        ...userWithoutPin,
        profile_pic_url,
        payment_receipt_url:
          user.role === UserRole.MEMBER ? payment_receipt_url : undefined,
        business_id:
          user.role === UserRole.MEMBER ? business?.id || null : undefined,
      },
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

    const updateData: Partial<User> = {};
    if (dto.full_name !== undefined) updateData.full_name = dto.full_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.whatsapp !== undefined) updateData.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;

    if (Object.keys(updateData).length > 0) {
      await this.usersRepository.update(userId, updateData);
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

        const businessUpdate: Partial<Business> = {};
        if (dto.category_id !== undefined)
          businessUpdate.category_id = dto.category_id;
        if (dto.business_name !== undefined)
          businessUpdate.name = dto.business_name;
        if (dto.business_description !== undefined)
          businessUpdate.description = dto.business_description;
        if (dto.website !== undefined) businessUpdate.website = dto.website;
        if (dto.gst_number !== undefined)
          businessUpdate.gst_number = dto.gst_number;

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
