import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { BusinessProfile } from './entities/business-profile.entity';
import { BusinessCategory } from './entities/business-category.entity';
import { User } from '../users/entities/user.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';
import {
  UserRole,
  UserStatus,
  BusinessStatus,
  MediaPurpose,
  NotificationType,
} from '../../common/enums';
import {
  UpdateBusinessDto,
  BusinessQueryDto,
} from './schemas/businesses.schema';
import { AnalyticsService } from '../analytics/analytics.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);
  constructor(
    @InjectRepository(BusinessProfile)
    private readonly businessRepository: Repository<BusinessProfile>,
    @InjectRepository(BusinessCategory)
    private readonly categoryRepository: Repository<BusinessCategory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly mediaService: MediaService,
    private readonly auditService: AuditService,
    private readonly analyticsService: AnalyticsService,
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  async getCategories(): Promise<{
    success: boolean;
    count: number;
    data: BusinessCategory[];
  }> {
    const categories = await this.categoryRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });

    return {
      success: true,
      count: categories.length,
      data: categories,
    };
  }

  async validateCategoryExists(
    categoryId: string,
  ): Promise<BusinessCategory | null> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, is_active: true },
    });
    return category;
  }

  async createBusiness(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const user = await this.userRepository.findOne({ where: { id: data.owner_id } });
    if (!user || user.role !== UserRole.MEMBER) {
      throw new BadRequestException('Only users with MEMBER role can create a Business Profile.');
    }

    const business = this.businessRepository.create(data);
    const saved = await this.businessRepository.save(business);
    if (saved) {
      let categoryName = 'General';
      if (saved.category_id) {
        const cat = await this.categoryRepository.findOne({ where: { id: saved.category_id } });
        if (cat) categoryName = cat.name;
      }
      await this.analyticsService.trackBusinessCreated(saved.category_id, categoryName);
    }
    return saved;
  }

  private async enrichBusinessesWithMediaAndCategory(businesses: BusinessProfile[]) {
    if (businesses.length === 0) return [];

    const logoIds = businesses
      .map((b) => b.logo_id)
      .filter((id): id is string => !!id);

    const mediaMap = new Map<string, string>();
    if (logoIds.length > 0) {
      const mediaFiles = await this.mediaRepository.find({
        where: { id: In(logoIds) },
      });
      mediaFiles.forEach((m) => mediaMap.set(m.id, m.file_url));
    }

    return businesses.map((b) => {
      const { ...biz } = b;
      const categoryName = b.category ? b.category.name : 'General';
      const phone = b.owner ? (b.owner.phone || '') : '';
      const whatsapp = b.owner?.profile?.whatsapp || phone || '';
      const owner_name = b.owner?.profile?.full_name || '';
      const owner_email = b.owner ? (b.owner.email || '') : '';
      const initials = (b.name || 'BI')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      delete (biz as any).category;
      delete (biz as any).owner;
      return {
        ...biz,
        categoryName,
        category_name: categoryName,
        phone,
        whatsapp,
        owner_name,
        owner_email,
        initials,
        logo_url: b.logo_id ? mediaMap.get(b.logo_id) || null : null,
        logoUrl: b.logo_id ? mediaMap.get(b.logo_id) || null : null,
      };
    });
  }

  async getCategoryById(idOrSlug: string): Promise<{
    success: boolean;
    data: BusinessCategory;
  }> {
    let category: BusinessCategory | null = null;
    if (this.isUUID(idOrSlug)) {
      category = await this.categoryRepository.findOne({
        where: { id: idOrSlug, is_active: true },
      });
    } else {
      category = await this.categoryRepository.findOne({
        where: { slug: idOrSlug, is_active: true },
      });
    }

    if (!category) {
      throw new NotFoundException('Business category not found');
    }

    return {
      success: true,
      data: category,
    };
  }

  private applySearchFilters(
    qb: SelectQueryBuilder<BusinessProfile>,
    query: BusinessQueryDto,
  ) {
    const searchKeyword = query.q || query.search;
    const needsOwnerJoin =
      !!searchKeyword ||
      !!query.full_name ||
      !!query.phone ||
      !!query.whatsapp ||
      !!query.email ||
      !!query.address;

    const needsCategoryJoin =
      !!searchKeyword ||
      !!query.category_name ||
      !!query.slug ||
      !!query.category_description;

    const hasOwnerJoin = qb.expressionMap.joinAttributes.some(
      (j) => j.alias.name === 'owner',
    );
    const hasCategoryJoin = qb.expressionMap.joinAttributes.some(
      (j) => j.alias.name === 'category',
    );

    if (needsOwnerJoin && !hasOwnerJoin) {
      qb.leftJoin('business.owner', 'owner');
      qb.leftJoin('owner.profile', 'profile');
    }
    if (needsCategoryJoin && !hasCategoryJoin) {
      qb.leftJoin('business.category', 'category');
    }

    if (query.states) {
      qb.andWhere('business.state_id IN (:...states)', {
        states: query.states.split(','),
      });
    }
    if (query.districts) {
      qb.andWhere('business.district_id IN (:...districts)', {
        districts: query.districts.split(','),
      });
    }

    if (searchKeyword) {
      qb.andWhere(
        '(business.name ILIKE :kw OR ' +
          'business.description ILIKE :kw OR ' +
          'business.website ILIKE :kw OR ' +
          'business.gst_number ILIKE :kw OR ' +
          'profile.full_name ILIKE :kw OR ' +
          'owner.phone ILIKE :kw OR ' +
          'profile.whatsapp ILIKE :kw OR ' +
          'owner.email ILIKE :kw OR ' +
          'business.address ILIKE :kw OR ' +
          'category.name ILIKE :kw OR ' +
          'category.slug ILIKE :kw OR ' +
          'category.description ILIKE :kw)',
        { kw: `%${searchKeyword}%` },
      );
    }

    if (query.full_name) {
      qb.andWhere('profile.full_name ILIKE :fullName', {
        fullName: `%${query.full_name}%`,
      });
    }
    if (query.phone) {
      qb.andWhere('owner.phone ILIKE :phone', {
        phone: `%${query.phone}%`,
      });
    }
    if (query.whatsapp) {
      qb.andWhere('profile.whatsapp ILIKE :whatsapp', {
        whatsapp: `%${query.whatsapp}%`,
      });
    }
    if (query.email) {
      qb.andWhere('owner.email ILIKE :email', {
        email: `%${query.email}%`,
      });
    }
    if (query.address) {
      qb.andWhere('business.address ILIKE :address', {
        address: `%${query.address}%`,
      });
    }
    if (query.category_name) {
      qb.andWhere('category.name ILIKE :catName', {
        catName: `%${query.category_name}%`,
      });
    }
    if (query.slug) {
      qb.andWhere('category.slug ILIKE :catSlug', {
        catSlug: `%${query.slug}%`,
      });
    }
    if (query.category_description) {
      qb.andWhere('category.description ILIKE :catDesc', {
        catDesc: `%${query.category_description}%`,
      });
    }
    if (query.business_name) {
      qb.andWhere('business.name ILIKE :bizName', {
        bizName: `%${query.business_name}%`,
      });
    }
    if (query.description) {
      qb.andWhere('business.description ILIKE :bizDesc', {
        bizDesc: `%${query.description}%`,
      });
    }
    if (query.website) {
      qb.andWhere('business.website ILIKE :website', {
        website: `%${query.website}%`,
      });
    }
    if (query.gst_number) {
      qb.andWhere('business.gst_number ILIKE :gstNumber', {
        gstNumber: `%${query.gst_number}%`,
      });
    }
  }

  async findAll(
    query: BusinessQueryDto = {},
    currentUser?: { id: string; role: UserRole },
  ) {
    const qb = this.businessRepository.createQueryBuilder('business');
    qb.leftJoinAndSelect('business.category', 'category');
    qb.leftJoinAndSelect('business.owner', 'owner');
    qb.leftJoinAndSelect('owner.profile', 'profile');

    // Filter by visibility rights
    if (!currentUser || currentUser.role === UserRole.CUSTOMER) {
      qb.andWhere('business.status = :activeStatus', {
        activeStatus: BusinessStatus.ACTIVE,
      });
    } else if (currentUser.role === UserRole.MEMBER) {
      qb.andWhere(
        '(business.status = :activeStatus OR business.owner_id = :currentUserId)',
        {
          activeStatus: BusinessStatus.ACTIVE,
          currentUserId: currentUser.id,
        },
      );
    }
    // Admin sees all statuses unless specifically filtered

    if (query.exclude_owner_id) {
      qb.andWhere('business.owner_id != :exOwnerId', {
        exOwnerId: query.exclude_owner_id,
      });
    }

    this.applySearchFilters(qb, query);

    if (query.category_id) {
      if (this.isUUID(query.category_id)) {
        qb.andWhere('business.category_id = :catId', {
          catId: query.category_id,
        });
      } else {
        const cat = await this.categoryRepository.findOne({
          where: { slug: query.category_id },
        });
        if (cat) {
          qb.andWhere('business.category_id = :catId', { catId: cat.id });
        } else {
          // No match for category slug
          qb.andWhere('1 = 0');
        }
      }
    }

    if (query.is_featured !== undefined) {
      qb.andWhere('business.is_featured = :isFeatured', {
        isFeatured: query.is_featured,
      });
    }

    qb.orderBy('business.created_at', 'DESC');

    const items = await qb.getMany();
    const enriched = await this.enrichBusinessesWithMediaAndCategory(items);

    return {
      success: true,
      message: 'Businesses fetched successfully',
      data: enriched,
    };
  }

  async findFeatured(
    query: BusinessQueryDto = {},
    currentUser?: { id: string; role: UserRole },
  ) {
    const qb = this.businessRepository.createQueryBuilder('business');
    qb.leftJoinAndSelect('business.category', 'category');
    qb.leftJoinAndSelect('business.owner', 'owner');
    qb.leftJoinAndSelect('owner.profile', 'profile');

    // Filter by visibility rights
    if (!currentUser || currentUser.role === UserRole.CUSTOMER) {
      qb.andWhere('business.status = :activeStatus', {
        activeStatus: BusinessStatus.ACTIVE,
      });
    } else if (currentUser.role === UserRole.MEMBER) {
      qb.andWhere(
        '(business.status = :activeStatus OR business.owner_id = :currentUserId)',
        {
          activeStatus: BusinessStatus.ACTIVE,
          currentUserId: currentUser.id,
        },
      );
    }

    qb.andWhere('business.is_featured = :isFeatured', {
      isFeatured: true,
    });

    this.applySearchFilters(qb, query);

    if (query.category_id) {
      if (this.isUUID(query.category_id)) {
        qb.andWhere('business.category_id = :catId', {
          catId: query.category_id,
        });
      } else {
        const cat = await this.categoryRepository.findOne({
          where: { slug: query.category_id },
        });
        if (cat) {
          qb.andWhere('business.category_id = :catId', { catId: cat.id });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    qb.orderBy('business.created_at', 'DESC');
    const settings = await this.settingsService.getSettings();
    qb.take(settings.home_feed_limit);

    const items = await qb.getMany();
    const enriched = await this.enrichBusinessesWithMediaAndCategory(items);

    return {
      success: true,
      message: 'Featured businesses fetched successfully',
      data: enriched,
    };
  }

  async findTop(
    query: BusinessQueryDto = {},
    currentUser?: { id: string; role: UserRole },
  ) {
    const qb = this.businessRepository.createQueryBuilder('business');
    qb.leftJoinAndSelect('business.category', 'category');
    qb.leftJoinAndSelect('business.owner', 'owner');
    qb.leftJoinAndSelect('owner.profile', 'profile');
    qb.leftJoin('vouchers', 'voucher', 'voucher.business_id = business.id');

    // Filter by visibility rights
    if (!currentUser || currentUser.role === UserRole.CUSTOMER) {
      qb.andWhere('business.status = :activeStatus', {
        activeStatus: BusinessStatus.ACTIVE,
      });
    } else if (currentUser.role === UserRole.MEMBER) {
      qb.andWhere(
        '(business.status = :activeStatus OR business.owner_id = :currentUserId)',
        {
          activeStatus: BusinessStatus.ACTIVE,
          currentUserId: currentUser.id,
        },
      );
    }

    this.applySearchFilters(qb, query);

    if (query.category_id) {
      if (this.isUUID(query.category_id)) {
        qb.andWhere('business.category_id = :catId', {
          catId: query.category_id,
        });
      } else {
        const cat = await this.categoryRepository.findOne({
          where: { slug: query.category_id },
        });
        if (cat) {
          qb.andWhere('business.category_id = :catId', { catId: cat.id });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    // Group by business to aggregate voucher count
    qb.groupBy('business.id');
    qb.addGroupBy('category.id');
    qb.addGroupBy('owner.id');
    qb.addGroupBy('profile.id');

    // Order by number of distinct customers who claimed vouchers, then by created_at
    qb.addSelect('COUNT(DISTINCT voucher.customer_id)', 'voucherCount');
    qb.orderBy('voucherCount', 'DESC');
    qb.addOrderBy('business.created_at', 'DESC');
    const settings = await this.settingsService.getSettings();
    qb.take(settings.home_feed_limit);

    const items = await qb.getMany();
    const enriched = await this.enrichBusinessesWithMediaAndCategory(items);

    return {
      success: true,
      message: 'Top businesses fetched successfully',
      data: enriched,
    };
  }

  async findByCategory(
    categoryIdOrSlug: string,
    query: BusinessQueryDto = {},
    currentUser?: { id: string; role: UserRole },
  ) {
    let category: BusinessCategory | null = null;
    if (this.isUUID(categoryIdOrSlug)) {
      category = await this.categoryRepository.findOne({
        where: { id: categoryIdOrSlug, is_active: true },
      });
    } else {
      category = await this.categoryRepository.findOne({
        where: { slug: categoryIdOrSlug, is_active: true },
      });
    }

    if (!category) {
      throw new NotFoundException('Business category not found');
    }

    return this.findAll({ ...query, category_id: category.id }, currentUser);
  }

  async findOne(id: string, currentUser?: { id: string; role: UserRole }) {
    if (!this.isUUID(id)) {
      throw new BadRequestException('Invalid business ID format');
    }

    const business = await this.businessRepository.findOne({ 
      where: { id },
      relations: { category: true, owner: { profile: true } }
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Access rights check
    if (business.status !== BusinessStatus.ACTIVE) {
      if (
        !currentUser ||
        (currentUser.role !== UserRole.ADMIN &&
          business.owner_id !== currentUser.id)
      ) {
        throw new ForbiddenException(
          'You do not have rights to view this non-active business listing',
        );
      }
    }

    const enriched = await this.enrichBusinessesWithMediaAndCategory([
      business,
    ]);

    return {
      success: true,
      message: 'Business details fetched successfully',
      data: enriched[0],
    };
  }

  async findOneByOwnerId(ownerId: string): Promise<BusinessProfile | null> {
    return this.businessRepository.findOne({ where: { owner_id: ownerId } });
  }

  async update(
    id: string,
    userId: string,
    userRole: UserRole,
    dto: UpdateBusinessDto,
    logoFile?: Express.Multer.File,
    ipAddress?: string,
  ) {
    if (!this.isUUID(id)) {
      throw new BadRequestException('Invalid business ID format');
    }

    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const isAdmin = userRole === UserRole.ADMIN;
    const isOwner = business.owner_id === userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'You can only update your own business listing',
      );
    }

    if (!isAdmin) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user && user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          'Your member account is suspended or not active',
        );
      }
    }
    if (dto.category_id && dto.category_id !== business.category_id) {
      const category = await this.validateCategoryExists(dto.category_id);
      if (!category) {
        throw new BadRequestException(
          'Selected business category ID does not exist or is inactive',
        );
      }
    }

    const updateData: Partial<BusinessProfile> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.category_id !== undefined) updateData.category_id = dto.category_id;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.gst_number !== undefined) updateData.gst_number = dto.gst_number;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.state_id !== undefined) updateData.state_id = dto.state_id;
    if (dto.district_id !== undefined) updateData.district_id = dto.district_id;

    if (logoFile) {
      const media = await this.mediaService.replaceUserFile(
        logoFile,
        business.owner_id,
        MediaPurpose.BUSINESS_LOGO,
      );
      updateData.logo_id = media.id;
    }

    if (!isAdmin) {
      this.logger.log(
        `Business listing ${business.id} modified by member ${userId}. Setting status to PENDING for admin re-approval.`,
      );
      updateData.status = BusinessStatus.PENDING;
    }

    if (Object.keys(updateData).length > 0) {
      await this.businessRepository.update(id, updateData);
    }

    const updated = await this.findOne(id, { id: userId, role: userRole });
    return {
      success: true,
      message: 'Business listing updated successfully',
      data: updated.data,
    };
  }

  async delete(
    id: string,
    userId: string,
    userRole: UserRole,
    ipAddress?: string,
  ) {
    if (!this.isUUID(id)) {
      throw new BadRequestException('Invalid business ID format');
    }

    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify ownership or Admin role rights
    if (userRole !== UserRole.ADMIN && business.owner_id !== userId) {
      throw new ForbiddenException(
        'You do not have rights to delete this business profile',
      );
    }

    if (business.logo_id) {
      try {
        const logo = await this.mediaRepository.findOne({
          where: { id: business.logo_id },
        });
        if (logo) {
          await this.mediaRepository.remove(logo);
        }
      } catch (err) {
        // Continue if logo cleanup fails
      }
    }

    await this.businessRepository.delete(id);

    await this.auditService.createLog({
      user_id: userId,
      action: 'BUSINESS_DELETION',
      entity_type: 'Business',
      entity_id: id,
      old_data: { name: business.name, owner_id: business.owner_id },
      ip_address: ipAddress,
    });

    return {
      success: true,
      message: 'Business listing deleted successfully',
    };
  }

  async updateStatus(
    businessId: string,
    status: BusinessStatus,
    adminId: string,
    ipAddress?: string,
  ) {
    if (!this.isUUID(businessId)) {
      throw new BadRequestException('Invalid business ID format');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const oldStatus = business.status;
    await this.businessRepository.update(businessId, {
      status,
    });

    await this.auditService.createLog({
      user_id: adminId,
      action: 'BUSINESS_STATUS_UPDATED',
      entity_type: 'Business',
      entity_id: businessId,
      old_data: { status: oldStatus },
      new_data: { status },
      ip_address: ipAddress,
    });

    const updated = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: { category: true, owner: { profile: true } }
    });
    const enriched = await this.enrichBusinessesWithMediaAndCategory(
      updated ? [updated] : [business],
    );

    if (updated && updated.owner) {
      const titleMap = {
        [BusinessStatus.ACTIVE]: 'Business Profile Approved',
        [BusinessStatus.REJECTED]: 'Business Profile Update',
        [BusinessStatus.SUSPENDED]: 'Business Profile Suspended'
      };
      const messageMap = {
        [BusinessStatus.ACTIVE]: `Your business profile for ${updated.name} has been approved and is now live.`,
        [BusinessStatus.REJECTED]: `We regret to inform you that your business profile for ${updated.name} has been rejected.`,
        [BusinessStatus.SUSPENDED]: `Your business profile for ${updated.name} has been suspended.`
      };

      if (titleMap[status]) {
        await this.notificationsService.create({
          user_id: updated.owner.id,
          title: titleMap[status],
          message: messageMap[status],
          type: NotificationType.GENERAL,
        });
        await this.mailService.sendBusinessStatusEmail(updated.owner.email, status, updated.name);
      }
    }

    return {
      success: true,
      message: `Business status updated to ${status} successfully`,
      data: enriched[0],
    };
  }

  async featureBusiness(
    businessId: string,
    isFeatured: boolean,
    adminId: string,
    ipAddress?: string,
  ) {
    if (!this.isUUID(businessId)) {
      throw new BadRequestException('Invalid business ID format');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const oldFeatured = business.is_featured;
    await this.businessRepository.update(businessId, {
      is_featured: isFeatured,
    });

    await this.auditService.createLog({
      user_id: adminId,
      action: isFeatured ? 'BUSINESS_FEATURED' : 'BUSINESS_UNFEATURED',
      entity_type: 'Business',
      entity_id: businessId,
      old_data: { is_featured: oldFeatured },
      new_data: { is_featured: isFeatured },
      ip_address: ipAddress,
    });

    const updated = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: { category: true, owner: { profile: true } }
    });
    const enriched = await this.enrichBusinessesWithMediaAndCategory(
      updated ? [updated] : [business],
    );

    return {
      success: true,
      message: `Business ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: enriched[0],
    };
  }
}
