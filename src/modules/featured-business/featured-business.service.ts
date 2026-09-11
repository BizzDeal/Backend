import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
export class FeaturedBusinessService {
  private readonly logger = new Logger(FeaturedBusinessService.name);

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

  /**
   * Check if a category currently has an active, live featured business,
   * or has an approved request that overlaps with the given date range.
   */
  async findConflictingApprovedRequest(
    categoryId: string,
    startDate?: Date,
    endDate?: Date,
    excludeRequestId?: string,
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

    // Check single featured per category live rule:
    // If a featured request is live in this category, cannot submit a new request
    const conflictingApproved = await this.findConflictingApprovedRequest(
      business.category_id,
      startDate,
      endDate,
    );

    if (conflictingApproved) {
      const isCurrentlyLive =
        conflictingApproved.start_date <= new Date() &&
        conflictingApproved.end_date >= new Date();

      const reasonMsg = isCurrentlyLive
        ? `A featured business is currently active in this category until ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. New requests cannot be submitted while one is live.`
        : `Another business in this category is already approved to be featured between ${new Date(
            conflictingApproved.start_date,
          ).toLocaleDateString()} and ${new Date(
            conflictingApproved.end_date,
          ).toLocaleDateString()}. Only one featured business per category is allowed.`;

      throw new BadRequestException(reasonMsg);
    }

    // Save banner image
    let bannerId: string | null = null;
    if (bannerFile) {
      const media = await this.mediaService.saveFile(
        bannerFile,
        user.id,
        MediaPurpose.BUSINESS_BANNER,
      );
      bannerId = media.id;
    }

    // If member already has a pending request, update it
    const existingPending = await this.featuredRequestRepo.findOne({
      where: {
        business_id: businessId,
        status: FeaturedRequestStatus.PENDING,
      },
    });

    let saved: FeaturedBusinessRequest;
    if (existingPending) {
      existingPending.title = dto.title;
      existingPending.description = dto.description;
      existingPending.start_date = startDate;
      existingPending.end_date = endDate;
      if (bannerId) {
        existingPending.banner_id = bannerId;
      }
      if (isAdmin) {
        existingPending.status = FeaturedRequestStatus.APPROVED;
        existingPending.approved_by_id = user.id;
        existingPending.approved_at = new Date();
      }
      saved = await this.featuredRequestRepo.save(existingPending);
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

    request.status = FeaturedRequestStatus.APPROVED;
    request.approved_by_id = adminUser.id;
    request.approved_at = new Date();
    request.rejection_reason = null;

    const saved = await this.featuredRequestRepo.save(request);

    // If currently live in date range, set business is_featured = true
    const now = new Date();
    if (saved.start_date <= now && saved.end_date >= now) {
      await this.businessRepo.update(saved.business_id, { is_featured: true });
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

    // Clean up stale banner file
    if (request.banner_id) {
      await this.mediaService.deleteFileById(request.banner_id);
    }

    const media = await this.mediaService.saveFile(
      bannerFile,
      user.id,
      MediaPurpose.BUSINESS_BANNER,
    );

    request.banner_id = media.id;
    await this.featuredRequestRepo.save(request);

    return this.findById(request.id);
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
    });
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

    request.status = FeaturedRequestStatus.REJECTED;
    request.rejection_reason = dto.reason;
    request.approved_by_id = adminUser.id;

    const saved = await this.featuredRequestRepo.save(request);

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
    request.status = FeaturedRequestStatus.CANCELLED;
    const saved = await this.featuredRequestRepo.save(request);

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
      );

      if (conflict) {
        throw new BadRequestException(
          `Cannot update: Another business ("${conflict.business?.name || 'Partner'}") is already approved in this category between ${new Date(conflict.start_date).toLocaleDateString()} and ${new Date(conflict.end_date).toLocaleDateString()}.`,
        );
      }
    }

    if (dto.title) {
      request.title = dto.title;
    }
    if (dto.description) {
      request.description = dto.description;
    }

    request.start_date = startDate;
    request.end_date = endDate;

    if (dto.status) {
      request.status = dto.status;
      if (dto.status === FeaturedRequestStatus.APPROVED) {
        request.approved_by_id = adminUser.id;
        request.approved_at = new Date();
        request.rejection_reason = null;
      }
    }

    if (dto.rejection_reason !== undefined) {
      request.rejection_reason = dto.rejection_reason;
    }

    if (bannerFile) {
      if (request.banner_id) {
        await this.mediaService.deleteFileById(request.banner_id);
      }
      const media = await this.mediaService.saveFile(
        bannerFile,
        adminUser.id,
        MediaPurpose.BUSINESS_BANNER,
      );
      request.banner_id = media.id;
    }

    const saved = await this.featuredRequestRepo.save(request);
    await this.recalculateBusinessFeaturedStatus(saved.business_id);

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
