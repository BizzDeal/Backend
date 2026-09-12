import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BusinessStatus, FeaturedRequestStatus, MediaPurpose, UserRole } from '../../common/enums';
import { BusinessCategory } from '../businesses/entities/business-category.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { AppEventsGateway } from '../events/events.gateway';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { FeaturedBusinessRequest } from './entities/featured-business-request.entity';
import { FeaturedBusinessService } from './featured-business.service';
import { createFeaturedRequestSchema } from './schemas/featured-business.schema';

describe('Featured business edits', () => {
  const member = Object.assign(new User(), { id: 'member', role: UserRole.MEMBER });
  const admin = Object.assign(new User(), { id: 'admin', role: UserRole.ADMIN });
  const file = { originalname: 'featured.jpg', buffer: Buffer.from('image') } as Express.Multer.File;
  const details = { title: 'Updated showcase', description: 'Updated showcase description' };
  let business: BusinessProfile;
  let request: FeaturedBusinessRequest;
  let service: FeaturedBusinessService;
  const requestRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    exists: jest.fn(),
    query: jest.fn(),
  };
  const businessRepo = { findOne: jest.fn(), exists: jest.fn(), update: jest.fn() };
  const media = { saveFile: jest.fn(), deleteFileById: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    business = Object.assign(new BusinessProfile(), {
      id: 'business', owner_id: member.id, category_id: 'category',
      status: BusinessStatus.ACTIVE, banner_id: 'business-banner',
    });
    request = Object.assign(new FeaturedBusinessRequest(), {
      id: 'request', business_id: business.id, business, category_id: business.category_id,
      title: 'Original showcase', description: 'Original showcase description',
      start_date: new Date(Date.now() - 86400000), end_date: new Date(Date.now() + 86400000),
      status: FeaturedRequestStatus.APPROVED, banner_id: 'featured-banner',
      approved_at: new Date(Date.now() - 172800000), approved_by_id: admin.id,
    });
    businessRepo.findOne.mockResolvedValue(business);
    businessRepo.exists.mockImplementation(({ where }: any) => {
      const clauses = Array.isArray(where) ? where : [where];
      return Promise.resolve(clauses.some((c: any) =>
        (c.banner_id !== undefined && business.banner_id === c.banner_id) ||
        (c.featured_banner_id !== undefined && (business as any).featured_banner_id === c.featured_banner_id)
      ));
    });
    requestRepo.findOne.mockImplementation(({ where }: {
      where: { status?: FeaturedRequestStatus; id?: string };
    }) => Promise.resolve(!where.status || where.status === request.status ? { ...request } : null));
    requestRepo.update.mockImplementation((_id: string, update: Partial<FeaturedBusinessRequest>) => {
      Object.assign(request, update);
      return Promise.resolve({ affected: 1 });
    });
    requestRepo.exists.mockImplementation(({ where }: { where: { banner_id: string } }) =>
      Promise.resolve(request.banner_id === where.banner_id));
    requestRepo.query.mockResolvedValue([]);
    media.saveFile.mockResolvedValue({ id: 'new-featured-banner' });
    // Model the foreign key's ON DELETE SET NULL behavior to catch cross-banner deletion.
    media.deleteFileById.mockImplementation((id: string) => {
      if (business.banner_id === id) business.banner_id = null;
      if (request.banner_id === id) request.banner_id = null;
      return Promise.resolve();
    });
    service = new FeaturedBusinessService(
      requestRepo as unknown as Repository<FeaturedBusinessRequest>,
      businessRepo as unknown as Repository<BusinessProfile>,
      {} as Repository<BusinessCategory>,
      {} as Repository<User>,
      media as unknown as MediaService,
      {} as NotificationsService,
      { emitToUser: jest.fn() } as unknown as AppEventsGateway,
    );
  });

  it('accepts approved edits without dates and preserves dates, approval, and the business banner', async () => {
    const original = { ...request };
    const parsed = createFeaturedRequestSchema.parse(details);
    const result = await service.createRequest(parsed, member, file);

    expect(result).toMatchObject({ ...details, start_date: original.start_date,
      end_date: original.end_date, status: original.status, approved_at: original.approved_at,
      approved_by_id: original.approved_by_id, banner_id: 'new-featured-banner' });
    expect(business.banner_id).toBe('business-banner');
    expect(businessRepo.update).toHaveBeenCalledWith('business', {
      featured_banner_id: 'new-featured-banner',
    });
    expect(media.saveFile).toHaveBeenCalledWith(file, member.id, MediaPurpose.FEATURED_BUSINESS_BANNER);
    expect(media.deleteFileById).toHaveBeenCalledWith('featured-banner');
  });

  it('accepts multipart empty date fields for an approved edit', () => {
    expect(createFeaturedRequestSchema.parse({
      ...details,
      start_date: '',
      end_date: '',
      business_id: '',
    })).toMatchObject(details);
  });

  it('ignores changes to both approved dates', async () => {
    const original = { ...request };
    await service.createRequest({ ...details,
      start_date: new Date(Date.now() + 86400000),
      end_date: new Date(Date.now() + 86400000 * 30),
    }, member);
    expect(request.start_date).toEqual(original.start_date);
    expect(request.end_date).toEqual(original.end_date);
    expect(requestRepo.update).toHaveBeenCalledWith(request.id, details);
  });

  it.each(['details', 'banner', 'admin'] as const)(
    'preserves a shared business banner when saving through %s', async (mode) => {
      request.banner_id = business.banner_id;
      if (mode === 'details') await service.createRequest(details, member, file);
      if (mode === 'banner') await service.updateBanner(request.id, member, file);
      if (mode === 'admin') {
        jest.spyOn(service, 'findConflictingApprovedRequest').mockResolvedValue(null);
        jest.spyOn(service, 'recalculateBusinessFeaturedStatus').mockResolvedValue();
        await service.adminUpdateRequest(request.id, details, admin, file);
      }
      expect(request.banner_id).toBe('new-featured-banner');
      expect(business.banner_id).toBe('business-banner');
      expect(media.deleteFileById).not.toHaveBeenCalled();
    },
  );

  it('preserves an old banner still referenced by another featured request', async () => {
    requestRepo.exists.mockResolvedValue(true);
    await service.updateBanner(request.id, member, file);
    expect(media.deleteFileById).not.toHaveBeenCalled();
    expect(request.banner_id).toBe('new-featured-banner');
  });

  it('does not delete the existing banner if saving the new reference fails', async () => {
    requestRepo.update.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.createRequest(details, member, file)).rejects.toThrow('Database unavailable');
    expect(media.deleteFileById).not.toHaveBeenCalled();
    expect(request.banner_id).toBe('featured-banner');
  });

  it('requires dates for pending edits before uploading a file', async () => {
    request.status = FeaturedRequestStatus.PENDING;
    await expect(service.createRequest(details, member, file)).rejects.toThrow(BadRequestException);
    expect(media.saveFile).not.toHaveBeenCalled();
    expect(requestRepo.update).not.toHaveBeenCalled();
  });

  it('allows pending date edits and cleans up only their previous featured banner', async () => {
    request.status = FeaturedRequestStatus.PENDING;
    jest.spyOn(service, 'findConflictingApprovedRequest').mockResolvedValue(null);
    const dates = { start_date: new Date(Date.now() + 86400000), end_date: new Date(Date.now() + 86400000 * 7) };
    await service.createRequest({ ...details, ...dates }, member, file);
    expect(request).toMatchObject({ ...details, ...dates, status: FeaturedRequestStatus.PENDING });
    expect(media.deleteFileById).toHaveBeenCalledWith('featured-banner');
    expect(business.banner_id).toBe('business-banner');
  });

  it('rejects another member before uploading or saving a banner', async () => {
    const other = Object.assign(new User(), { id: 'other-member', role: UserRole.MEMBER });
    await expect(service.updateBanner(request.id, other, file)).rejects.toThrow(ForbiddenException);
    await expect(service.createRequest({ ...details, business_id: business.id }, other, file))
      .rejects.toThrow(ForbiddenException);
    expect(media.saveFile).not.toHaveBeenCalled();
    expect(requestRepo.update).not.toHaveBeenCalled();
  });
});
