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
import { Business } from './entities/business.entity';
import { BusinessCategory } from './entities/business-category.entity';
import { User } from '../users/entities/user.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { MediaService } from '../media/media.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, UserStatus, BusinessStatus, MediaPurpose } from '../../common/enums';
import {
  UpdateBusinessDto,
  BusinessQueryDto,
} from './schemas/businesses.schema';

@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(BusinessCategory)
    private readonly categoryRepository: Repository<BusinessCategory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly mediaService: MediaService,
    private readonly auditService: AuditService,
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

  async createBusiness(data: Partial<Business>): Promise<Business> {
    const business = this.businessRepository.create(data);
    return this.businessRepository.save(business);
  }

  private async enrichBusinessesWithMediaAndCategory(businesses: Business[]) {
    if (businesses.length === 0) return [];

    const logoIds = businesses
      .map((b) => b.logo_id)
      .filter((id): id is string => !!id);
    const categoryIds = businesses.map((b) => b.category_id);
    const ownerIds = businesses.map((b) => b.owner_id);

    const mediaMap = new Map<string, string>();
    if (logoIds.length > 0) {
      const mediaFiles = await this.mediaRepository.find({
        where: { id: In(logoIds) },
      });
      mediaFiles.forEach((m) => mediaMap.set(m.id, m.file_url));
    }

    const categoryMap = new Map<string, BusinessCategory>();
    const categories = await this.categoryRepository.find({
      where: { id: In(categoryIds) },
    });
    categories.forEach((c) => categoryMap.set(c.id, c));

    const ownerMap = new Map<string, Partial<User>>();
    const owners = await this.userRepository.find({
      where: { id: In(ownerIds) },
    });
    owners.forEach((o) => {
      const { pin_hash: _pin_hash, ...ownerData } = o;
      ownerMap.set(o.id, ownerData);
    });

    return businesses.map((b) => ({
      ...b,
      logo_url: b.logo_id ? mediaMap.get(b.logo_id) || null : null,
      category: categoryMap.get(b.category_id) || null,
      owner: ownerMap.get(b.owner_id) || null,
    }));
  }

  private applySearchFilters(
    qb: SelectQueryBuilder<Business>,
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

    if (needsOwnerJoin) {
      qb.leftJoin('business.owner', 'owner');
    }
    if (needsCategoryJoin) {
      qb.leftJoin('business.category', 'category');
    }

    if (searchKeyword) {
      qb.andWhere(
        '(business.name ILIKE :kw OR ' +
          'business.description ILIKE :kw OR ' +
          'business.website ILIKE :kw OR ' +
          'business.gst_number ILIKE :kw OR ' +
          'owner.full_name ILIKE :kw OR ' +
          'owner.phone ILIKE :kw OR ' +
          'owner.whatsapp ILIKE :kw OR ' +
          'owner.email ILIKE :kw OR ' +
          'owner.address ILIKE :kw OR ' +
          'category.name ILIKE :kw OR ' +
          'category.slug ILIKE :kw OR ' +
          'category.description ILIKE :kw)',
        { kw: `%${searchKeyword}%` },
      );
    }

    if (query.full_name) {
      qb.andWhere('owner.full_name ILIKE :fullName', {
        fullName: `%${query.full_name}%`,
      });
    }
    if (query.phone) {
      qb.andWhere('owner.phone ILIKE :phone', {
        phone: `%${query.phone}%`,
      });
    }
    if (query.whatsapp) {
      qb.andWhere('owner.whatsapp ILIKE :whatsapp', {
        whatsapp: `%${query.whatsapp}%`,
      });
    }
    if (query.email) {
      qb.andWhere('owner.email ILIKE :email', {
        email: `%${query.email}%`,
      });
    }
    if (query.address) {
      qb.andWhere('owner.address ILIKE :address', {
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

    const items = await qb.getMany();
    const enriched = await this.enrichBusinessesWithMediaAndCategory(items);

    return {
      success: true,
      message: 'Featured businesses fetched successfully',
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

    const business = await this.businessRepository.findOne({ where: { id } });
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

  async findOneByOwnerId(ownerId: string): Promise<Business | null> {
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

    const updateData: Partial<Business> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.category_id !== undefined) updateData.category_id = dto.category_id;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.gst_number !== undefined) updateData.gst_number = dto.gst_number;

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
