import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FeaturedBusinessRequest } from './entities/featured-business-request.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { BusinessCategory } from '../businesses/entities/business-category.entity';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppEventsGateway } from '../events/events.gateway';
import {
  CreateFeaturedRequestDto,
  RejectFeaturedRequestDto,
  QueryFeaturedRequestDto,
  AdminUpdateFeaturedRequestDto,
} from './schemas/featured-business.schema';
import {
  UserRole,
  BusinessStatus,
  MediaPurpose,
  FeaturedRequestStatus,
  NotificationType,
} from '../../common/enums';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FeaturedBusinessService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FeaturedBusinessService.name);
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(FeaturedBusinessRequest)
    private readonly featuredRequestRepo: Repository<FeaturedBusinessRequest>,
    @InjectRepository(BusinessProfile)
    private readonly businessRepo: Repository<BusinessProfile>,
    @InjectRepository(BusinessCategory)
    private readonly categoryRepo: Repository<BusinessCategory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
    private readonly appEventsGateway: AppEventsGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Initial sync on server boot
    await this.syncExpiredRequests();
    // Schedule periodic background sync every 2 minutes
    this.syncTimer = setInterval(() => {
      this.syncExpiredRequests().catch((err) =>
        this.logger.warn(`Background featured sync failed: ${err}`),
      );
    }, 2 * 60 * 1000);
    if (this.syncTimer && typeof this.syncTimer.unref === 'function') {
      this.syncTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Check if a category currently has an active, live featured business,
   * or has an approved request that overlaps with the given date range.
   */
  async findConflictingApprovedRequest(
    categoryId: string,
    startDate?: Date,
    endDate?: Date,
    excludeRequestId?: string,
    excludeBusinessId?: string,
  ): Promise<FeaturedBusinessRequest | null> {
    const now = new Date();
    const qb = this.featuredRequestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.business', 'business')
      .where('req.category_id = :categoryId', { categoryId })
      .andWhere('req.status = :status', { status: FeaturedRequestStatus.APPROVED });

    if (excludeRequestId) {
      qb.andWhere('req.id != :excludeId', { excludeId: excludeRequestId });
    }

    if (excludeBusinessId) {
      qb.andWhere('req.business_id != :excludeBizId', { excludeBizId: excludeBusinessId });
    }

    if (startDate && endDate) {
      // Overlapping date range condition:
      // req.start_date <= requested.end_date AND req.end_date >= requested.start_date
      qb.andWhere(
        '((req.start_date <= :endDate AND req.end_date >= :startDate) OR (req.start_date <= :now AND req.end_date >= :now))',
        {
          startDate,
          endDate,
          now,
        },
      );
    } else {
      // Check current live status
      qb.andWhere('req.start_date <= :now AND req.end_date >= :now', { now });
    }

    return qb.getOne();
  }

  /**
   * Public / Member status check for category live featured store
   */
  async getCategoryLiveStatus(categoryId: string): Promise<{
    is_live: boolean;
    live_request: {
      id: string;
      business_id: string;
      business_name: string;
      title: string;
      start_date: Date;
      end_date: Date;
    } | null;
  }> {
    await this.syncExpiredRequests();
    const live = await this.findConflictingApprovedRequest(categoryId);
    if (!live) {
      return { is_live: false, live_request: null };
    }
    return {
      is_live: true,
      live_request: {
        id: live.id,
        business_id: live.business_id,
        business_name: live.business?.name || 'Featured Partner',
        title: live.title,
        start_date: live.start_date,
        end_date: live.end_date,
      },
    };
  }

  /**
   * Member submits a new Featured Business Request
   */
  async createRequest(
    dto: CreateFeaturedRequestDto,
    user: User,
    bannerFile?: Express.Multer.File,
  ): Promise<FeaturedBusinessRequest> {
    const isAdmin = user.role === UserRole.ADMIN;
    let businessId = dto.business_id;

    let business: BusinessProfile | null = null;
    if (!businessId) {
      business = await this.businessRepo.findOne({
        where: { owner_id: user.id },
      });
      if (!business) {
        const userWithProfile = await this.userRepo.findOne({
          where: { id: user.id },
          relations: { business_profile: true },
        });
        if (userWithProfile?.business_profile) {
          business = userWithProfile.business_profile;
        }
      }
      if (!business) {
        throw new NotFoundException(
          'Could not find a business profile associated with your account.',
        );
      }
      businessId = business.id;
    } else {
      business = await this.businessRepo.findOne({
        where: { id: businessId },
      });
      if (!business) {
        throw new NotFoundException('Business profile not found.');
      }
      if (!isAdmin && business.owner_id !== user.id) {
        throw new ForbiddenException(
          'You can only submit featured requests for your own business.',
        );
      }
    }

    if (!isAdmin && business.status !== BusinessStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active verified business profiles can apply to become a Featured Business.',
      );
    }

    if (!business.category_id) {
      throw new BadRequestException(
        'Your business must have an assigned category to apply for featured status.',
      );
    }

    // Check if business already has an approved request
    const existingApproved = await this.featuredRequestRepo.findOne({
      where: {
        business_id: businessId,
        status: FeaturedRequestStatus.APPROVED,
      },
      order: { created_at: 'DESC' },
    });

    // If member has an approved request, showcase dates are strictly locked
    if (existingApproved && !isAdmin) {
      // Member can update title, description, and promotional banner
      // Showcase dates remain strictly locked to the approved dates and are never modified
      const approvedUpdate: Partial<FeaturedBusinessRequest> = {
        title: dto.title,
        description: dto.description,
      };
      if (bannerFile) {
        const media = await this.mediaService.saveFile(
          bannerFile,
          user.id,
          MediaPurpose.FEATURED_BUSINESS_BANNER,
        );
        approvedUpdate.banner_id = media.id;
      }

      // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
      await this.featuredRequestRepo.update(existingApproved.id, approvedUpdate);
      if (bannerFile) {
        const now = new Date();
        if (existingApproved.start_date <= now && existingApproved.end_date >= now) {
          await this.businessRepo.update(existingApproved.business_id, {
            featured_banner_id: approvedUpdate.banner_id,
          });
        }
        await this.deleteUnusedBanner(existingApproved.banner_id);
      }
      return this.findById(existingApproved.id);
    }

    await this.syncExpiredRequests();

    if (!dto.start_date || !dto.end_date) {
      throw new BadRequestException('Start date and end date are required.');
    }
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    // Validate past dates (allowing 5 minute clock tolerance)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (startDate < fiveMinutesAgo) {
      throw new BadRequestException('Start date cannot be in the past.');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    // If member already has a pending request, check for conflicts excluding it
    const existingPending = await this.featuredRequestRepo.findOne({
      where: {
        business_id: businessId,
        status: FeaturedRequestStatus.PENDING,
      },
      order: { created_at: 'DESC' },
    });

    // Check single featured per category live rule (excluding current business's own requests)
    const conflictingApproved = await this.findConflictingApprovedRequest(
      business.category_id,
      startDate,
      endDate,
      existingPending?.id,
      businessId,
    );

    if (conflictingApproved) {
      const isCurrentlyLive =
        conflictingApproved.start_date <= new Date() &&
        conflictingApproved.end_date >= new Date();

      const confBizName = conflictingApproved.business?.name || 'Another store';

      const reasonMsg = conflictingApproved.business_id === businessId
        ? `Your business is already approved to be featured in this category from ${new Date(
            conflictingApproved.start_date,
          ).toLocaleDateString()} to ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. Dates cannot be modified once approved. To choose different dates, please cancel your active showcase.`
        : isCurrentlyLive
        ? `The featured spot in this category is currently occupied by "${confBizName}" until ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. New requests cannot be submitted while a showcase is live.`
        : `The featured spot in this category is already booked by "${confBizName}" between ${new Date(
            conflictingApproved.start_date,
          ).toLocaleDateString()} and ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. Only one featured business per category is allowed.`;

      throw new BadRequestException(reasonMsg);
    }

    let bannerId: string | null = null;
    if (bannerFile) {
      const media = await this.mediaService.saveFile(
        bannerFile,
        user.id,
        MediaPurpose.FEATURED_BUSINESS_BANNER,
      );
      bannerId = media.id;
    }

    let saved: FeaturedBusinessRequest;
    if (existingPending) {
      const pendingUpdate: Partial<FeaturedBusinessRequest> = {
        title: dto.title,
        description: dto.description,
        start_date: startDate,
        end_date: endDate,
      };
      if (bannerId) {
        pendingUpdate.banner_id = bannerId;
      }
      if (isAdmin) {
        pendingUpdate.status = FeaturedRequestStatus.APPROVED;
        pendingUpdate.approved_by_id = user.id;
        pendingUpdate.approved_at = new Date();
      }
      // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
      await this.featuredRequestRepo.update(existingPending.id, pendingUpdate);
      if (bannerFile) {
        await this.deleteUnusedBanner(existingPending.banner_id);
      }
      saved = existingPending;
    } else {
      const req = this.featuredRequestRepo.create({
        business_id: businessId,
        category_id: business.category_id,
        title: dto.title,
        description: dto.description,
        start_date: startDate,
        end_date: endDate,
        banner_id: bannerId,
        status: isAdmin
          ? FeaturedRequestStatus.APPROVED
          : FeaturedRequestStatus.PENDING,
        approved_by_id: isAdmin ? user.id : null,
        approved_at: isAdmin ? new Date() : null,
      });
      saved = await this.featuredRequestRepo.save(req);
    }

    // If created by Admin and currently live, update business.is_featured
    if (isAdmin && startDate <= new Date() && endDate >= new Date()) {
      await this.businessRepo.update(businessId, { is_featured: true });
    }

    return this.findById(saved.id);
  }

  /**
   * Get member's own requests
   */
  async getMyRequests(user: User): Promise<FeaturedBusinessRequest[]> {
    await this.syncExpiredRequests();
    const businesses = await this.businessRepo.find({
      where: { owner_id: user.id },
    });
    const businessIds = businesses.map((b) => b.id);

    const userWithProfile = await this.userRepo.findOne({
      where: { id: user.id },
      relations: { business_profile: true },
    });
    if (
      userWithProfile?.business_profile?.id &&
      !businessIds.includes(userWithProfile.business_profile.id)
    ) {
      businessIds.push(userWithProfile.business_profile.id);
    }

    if (businessIds.length === 0) {
      if (user.role === UserRole.ADMIN) {
        return this.featuredRequestRepo.find({
          relations: {
            banner: true,
            category: true,
            business: true,
          },
          order: { created_at: 'DESC' },
        });
      }
      return [];
    }

    return this.featuredRequestRepo.find({
      where: { business_id: In(businessIds) },
      relations: {
        banner: true,
        category: true,
        business: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get single featured business request by ID
   */
  async findById(id: string): Promise<FeaturedBusinessRequest> {
    const request = await this.featuredRequestRepo.findOne({
      where: { id },
      relations: {
        business: { owner: { profile: true } },
        category: true,
        banner: true,
        approved_by: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Featured business request not found');
    }

    return request;
  }

  /**
   * Admin list all requests with filters
   */
  async findAll(query: QueryFeaturedRequestDto): Promise<FeaturedBusinessRequest[]> {
    await this.syncExpiredRequests();
    const qb = this.featuredRequestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.business', 'business')
      .leftJoinAndSelect('business.owner', 'owner')
      .leftJoinAndSelect('owner.profile', 'profile')
      .leftJoinAndSelect('req.category', 'category')
      .leftJoinAndSelect('req.banner', 'banner')
      .leftJoinAndSelect('req.approved_by', 'approved_by')
      .orderBy('req.created_at', 'DESC');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('req.status = :status', { status: query.status });
    }

    if (query.category_id) {
      qb.andWhere('req.category_id = :categoryId', {
        categoryId: query.category_id,
      });
    }

    if (query.business_id) {
      qb.andWhere('req.business_id = :businessId', {
        businessId: query.business_id,
      });
    }

    return qb.getMany();
  }

  /**
   * Admin approves request
   */
  async approveRequest(
    id: string,
    adminUser: User,
  ): Promise<FeaturedBusinessRequest> {
    const request = await this.findById(id);

    if (request.status === FeaturedRequestStatus.APPROVED) {
      return request;
    }

    // Category rule: Check if another request in this category is currently live or scheduled to overlap
    const conflictingApproved = await this.findConflictingApprovedRequest(
      request.category_id,
      request.start_date,
      request.end_date,
      request.id,
      request.business_id,
    );

    if (conflictingApproved) {
      const isCurrentlyLive =
        conflictingApproved.start_date <= new Date() &&
        conflictingApproved.end_date >= new Date();

      const confBizName =
        conflictingApproved.business?.name || 'Another business';

      const errorMsg = isCurrentlyLive
        ? `Cannot approve: "${confBizName}" is currently live as the Featured Business in this category until ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. Only one featured business per category is allowed.`
        : `Cannot approve: "${confBizName}" is already approved for featured status in this category between ${new Date(
            conflictingApproved.start_date,
          ).toLocaleDateString()} and ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}.`;

      throw new BadRequestException(errorMsg);
    }

    // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
    const approvedAt = new Date();
    await this.featuredRequestRepo.update(request.id, {
      status: FeaturedRequestStatus.APPROVED,
      approved_by_id: adminUser.id,
      approved_at: approvedAt,
      rejection_reason: null,
    });

    const saved = { ...request, status: FeaturedRequestStatus.APPROVED, approved_by_id: adminUser.id, approved_at: approvedAt, rejection_reason: null };

    // If currently live in date range, set business is_featured = true and assign featured_banner_id
    const now = new Date();
    if (saved.start_date <= now && saved.end_date >= now) {
      await this.businessRepo.update(saved.business_id, {
        is_featured: true,
        featured_banner_id: saved.banner_id || null,
      });
    }

    // Notify member
    await this.notifyMemberStatus(saved, 'APPROVED');

    return this.findById(saved.id);
  }

  /**
   * Member or Admin updates banner image only
   */
  async updateBanner(
    id: string,
    user: User,
    bannerFile?: Express.Multer.File,
  ): Promise<FeaturedBusinessRequest> {
    if (!bannerFile) {
      throw new BadRequestException('Please provide a banner image file.');
    }

    const request = await this.findById(id);

    if (
      user.role !== UserRole.ADMIN &&
      request.business?.owner_id !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to update the banner for this request.',
      );
    }

    const oldBannerId = request.banner_id;

    const media = await this.mediaService.saveFile(
      bannerFile,
      user.id,
      MediaPurpose.FEATURED_BUSINESS_BANNER,
    );

    // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
    await this.featuredRequestRepo.update(request.id, { banner_id: media.id });

    // If request is currently approved and live, update business_profiles.featured_banner_id
    const now = new Date();
    if (request.status === FeaturedRequestStatus.APPROVED && request.start_date <= now && request.end_date >= now) {
      await this.businessRepo.update(request.business_id, {
        featured_banner_id: media.id,
      });
    }

    // Clean up stale banner file after updating reference in request
    await this.deleteUnusedBanner(oldBannerId);

    return this.findById(request.id);
  }

  private async deleteUnusedBanner(bannerId: string | null): Promise<void> {
    if (!bannerId) return;

    try {
      // Older records may share an image with a business or another request.
      // Deleting that media would clear their banner references via ON DELETE SET NULL.
      const usedByBusiness = await this.businessRepo.exists({
        where: [{ banner_id: bannerId }, { featured_banner_id: bannerId }],
      });
      if (usedByBusiness) return;

      const usedByRequest = await this.featuredRequestRepo.exists({
        where: { banner_id: bannerId },
      });
      if (usedByRequest) return;

      await this.mediaService.deleteFileById(bannerId);
    } catch (err) {
      this.logger.warn(
        `Failed to clean up banner (${bannerId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Helper to recalculate business.is_featured based on currently active approved requests
   */
  async recalculateBusinessFeaturedStatus(businessId: string): Promise<void> {
    const now = new Date();
    const activeLiveRequest = await this.featuredRequestRepo
      .createQueryBuilder('req')
      .where('req.business_id = :businessId', { businessId })
      .andWhere('req.status = :status', { status: FeaturedRequestStatus.APPROVED })
      .andWhere('req.start_date <= :now AND req.end_date >= :now', { now })
      .getOne();

    await this.businessRepo.update(businessId, {
      is_featured: !!activeLiveRequest,
      featured_banner_id: activeLiveRequest?.banner_id || null,
    });
  }

  /**
   * Automatically transition expired approved requests to EXPIRED
   * and update business.is_featured flags
   */
  async syncExpiredRequests(): Promise<void> {
    try {
      const now = new Date();
      // 1. Mark expired approved requests as EXPIRED
      await this.featuredRequestRepo.query(
        `UPDATE "featured_business_requests"
         SET "status" = 'EXPIRED'
         WHERE "status" = 'APPROVED' AND "end_date" < $1`,
        [now],
      );

      // 2. Clear is_featured and featured_banner_id for businesses with no active approved live request
      await this.featuredRequestRepo.query(
        `UPDATE "business_profiles"
         SET "is_featured" = false,
             "featured_banner_id" = NULL
         WHERE "is_featured" = true
           AND "id" NOT IN (
             SELECT "business_id" FROM "featured_business_requests"
             WHERE "status" = 'APPROVED' AND "start_date" <= $1 AND "end_date" >= $1
           )`,
        [now],
      );

      // 3. Ensure is_featured is true and featured_banner_id is set for active approved live requests
      await this.featuredRequestRepo.query(
        `UPDATE "business_profiles" b
         SET "is_featured" = true,
             "featured_banner_id" = req."banner_id"
         FROM (
           SELECT DISTINCT ON ("business_id") "business_id", "banner_id"
           FROM "featured_business_requests"
           WHERE "status" = 'APPROVED' AND "start_date" <= $1 AND "end_date" >= $1
           ORDER BY "business_id", "created_at" DESC
         ) req
         WHERE b."id" = req."business_id"
           AND (b."is_featured" = false OR b."featured_banner_id" IS DISTINCT FROM req."banner_id")`,
        [now],
      );
    } catch (err) {
      this.logger.warn(`Failed to sync expired featured requests: ${err}`);
    }
  }

  /**
   * Admin rejects request with reason (can reject pending or approved)
   */
  async rejectRequest(
    id: string,
    dto: RejectFeaturedRequestDto,
    adminUser: User,
  ): Promise<FeaturedBusinessRequest> {
    const request = await this.findById(id);
    const wasApproved = request.status === FeaturedRequestStatus.APPROVED;

    // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
    await this.featuredRequestRepo.update(request.id, {
      status: FeaturedRequestStatus.REJECTED,
      rejection_reason: dto.reason,
      approved_by_id: adminUser.id,
    });

    const saved = { ...request, status: FeaturedRequestStatus.REJECTED, rejection_reason: dto.reason, approved_by_id: adminUser.id };

    if (wasApproved) {
      await this.recalculateBusinessFeaturedStatus(saved.business_id);
    }

    // Notify member
    await this.notifyMemberStatus(saved, 'REJECTED', dto.reason);

    return this.findById(saved.id);
  }

  /**
   * Member or Admin cancels their pending or approved request
   */
  async cancelRequest(id: string, user: User): Promise<FeaturedBusinessRequest> {
    const request = await this.findById(id);

    if (
      user.role !== UserRole.ADMIN &&
      request.business?.owner_id !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to cancel this request.',
      );
    }

    if (
      request.status !== FeaturedRequestStatus.PENDING &&
      request.status !== FeaturedRequestStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only pending or approved requests can be cancelled.',
      );
    }

    const wasApproved = request.status === FeaturedRequestStatus.APPROVED;
    // Use update() instead of save() to prevent TypeORM from cascade-persisting loaded relations
    await this.featuredRequestRepo.update(request.id, {
      status: FeaturedRequestStatus.CANCELLED,
    });
    const saved = { ...request, status: FeaturedRequestStatus.CANCELLED as FeaturedRequestStatus };

    if (wasApproved) {
      await this.recalculateBusinessFeaturedStatus(saved.business_id);
    }

    try {
      this.appEventsGateway.emitToUser(
        request.business?.owner_id || user.id,
        'FEATURED_REQUEST_STATUS_UPDATED',
        {
          request_id: request.id,
          business_id: request.business_id,
          title: request.title,
          status: FeaturedRequestStatus.CANCELLED,
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to emit cancel event: ${err}`);
    }

    return this.findById(saved.id);
  }

  /**
   * Admin updates an existing featured request (dates, title, description, banner, status)
   */
  async adminUpdateRequest(
    id: string,
    dto: AdminUpdateFeaturedRequestDto,
    adminUser: User,
    bannerFile?: Express.Multer.File,
  ): Promise<FeaturedBusinessRequest> {
    const request = await this.findById(id);

    let startDate = request.start_date;
    let endDate = request.end_date;

    if (dto.start_date) {
      startDate = new Date(dto.start_date);
    }
    if (dto.end_date) {
      endDate = new Date(dto.end_date);
    }

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be strictly after start date.');
    }

    const targetStatus = dto.status || request.status;

    // Check conflict if target status is APPROVED
    if (targetStatus === FeaturedRequestStatus.APPROVED) {
      const conflict = await this.findConflictingApprovedRequest(
        request.category_id,
        startDate,
        endDate,
        request.id,
        request.business_id,
      );

      if (conflict) {
        throw new BadRequestException(
          `Cannot update: Another business ("${conflict.business?.name || 'Partner'}") is already approved in this category between ${new Date(conflict.start_date).toLocaleDateString()} and ${new Date(conflict.end_date).toLocaleDateString()}.`,
        );
      }
    }

    // Build targeted update payload to prevent TypeORM from cascade-persisting loaded relations
    const adminUpdate: Partial<FeaturedBusinessRequest> = {
      start_date: startDate,
      end_date: endDate,
    };

    if (dto.title) {
      adminUpdate.title = dto.title;
    }
    if (dto.description) {
      adminUpdate.description = dto.description;
    }

    if (dto.status) {
      adminUpdate.status = dto.status;
      if (dto.status === FeaturedRequestStatus.APPROVED) {
        adminUpdate.approved_by_id = adminUser.id;
        adminUpdate.approved_at = new Date();
        adminUpdate.rejection_reason = null;
      }
    }

    if (dto.rejection_reason !== undefined) {
      adminUpdate.rejection_reason = dto.rejection_reason;
    }

    const oldBannerId = bannerFile ? request.banner_id : null;

    if (bannerFile) {
      const media = await this.mediaService.saveFile(
        bannerFile,
        adminUser.id,
        MediaPurpose.FEATURED_BUSINESS_BANNER,
      );
      adminUpdate.banner_id = media.id;
    }

    await this.featuredRequestRepo.update(request.id, adminUpdate);
    const saved = { ...request, ...adminUpdate };
    await this.recalculateBusinessFeaturedStatus(saved.business_id);

    await this.deleteUnusedBanner(oldBannerId);

    try {
      this.appEventsGateway.emitToUser(
        request.business?.owner_id || adminUser.id,
        'FEATURED_REQUEST_STATUS_UPDATED',
        {
          request_id: saved.id,
          business_id: saved.business_id,
          title: saved.title,
          status: saved.status,
          reason: saved.rejection_reason,
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to emit update event: ${err}`);
    }

    return this.findById(saved.id);
  }

  private async notifyMemberStatus(
    request: FeaturedBusinessRequest,
    status: 'APPROVED' | 'REJECTED',
    reason?: string,
  ): Promise<void> {
    try {
      const business = await this.businessRepo.findOne({
        where: { id: request.business_id },
      });
      if (!business || !business.owner_id) return;

      const title =
        status === 'APPROVED'
          ? '🌟 Featured Business Request Approved!'
          : '❌ Featured Business Request Update';

      const message =
        status === 'APPROVED'
          ? `Congratulations! Your business "${business.name}" is approved as the Featured Business from ${new Date(
              request.start_date,
            ).toLocaleDateString()} to ${new Date(
              request.end_date,
            ).toLocaleDateString()}.`
          : `Your featured business request for "${business.name}" was rejected by Admin.${
              reason ? ' Reason: ' + reason : ''
            }`;

      await this.notificationsService.create({
        user_id: business.owner_id,
        title,
        message,
        type: NotificationType.FEATURED_REQUEST,
        data: {
          request_id: request.id,
          business_id: request.business_id,
          status,
          reason,
        },
      });

      this.appEventsGateway.emitToUser(
        business.owner_id,
        'FEATURED_REQUEST_STATUS_UPDATED',
        {
          request_id: request.id,
          business_id: request.business_id,
          title: request.title,
          status,
          reason,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send featured request status notification: ${err}`,
      );
    }
  }
}
