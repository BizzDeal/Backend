import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FeaturedBusinessService } from './featured-business.service';
import { FeaturedBusinessRequest } from './entities/featured-business-request.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { BusinessCategory } from '../businesses/entities/business-category.entity';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppEventsGateway } from '../events/events.gateway';
import { UserRole, BusinessStatus, FeaturedRequestStatus } from '../../common/enums';
import { User } from '../users/entities/user.entity';

describe('FeaturedBusinessService', () => {
  let service: FeaturedBusinessService;
  let featuredRequestRepo: any;
  let businessRepo: any;
  let categoryRepo: any;
  let mediaService: any;
  let notificationsService: any;
  let appEventsGateway: any;

  const mockUser: User = {
    id: 'user-123',
    role: UserRole.MEMBER,
  } as any;

  const mockAdmin: User = {
    id: 'admin-999',
    role: UserRole.ADMIN,
  } as any;

  const mockBusiness: BusinessProfile = {
    id: 'biz-123',
    owner_id: 'user-123',
    category_id: 'cat-123',
    name: 'Best Electronics',
    status: BusinessStatus.ACTIVE,
  } as any;

  beforeEach(async () => {
    featuredRequestRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ id: 'req-new', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: entity.id || 'req-saved', ...entity })),
    };

    businessRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    categoryRepo = {
      findOne: jest.fn(),
    };

    mediaService = {
      saveFile: jest.fn().mockResolvedValue({ id: 'media-banner-1' }),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    appEventsGateway = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturedBusinessService,
        { provide: getRepositoryToken(FeaturedBusinessRequest), useValue: featuredRequestRepo },
        { provide: getRepositoryToken(BusinessProfile), useValue: businessRepo },
        { provide: getRepositoryToken(BusinessCategory), useValue: categoryRepo },
        { provide: MediaService, useValue: mediaService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AppEventsGateway, useValue: appEventsGateway },
      ],
    }).compile();

    service = module.get<FeaturedBusinessService>(FeaturedBusinessService);
  });

  describe('createRequest', () => {
    it('should throw BadRequestException if start_date is in the past', async () => {
      businessRepo.findOne.mockResolvedValue(mockBusiness);

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      await expect(
        service.createRequest(
          {
            title: 'Festival Sale',
            description: 'Huge discounts on all electronics items',
            start_date: pastDate,
            end_date: futureDate,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if end_date is before start_date', async () => {
      businessRepo.findOne.mockResolvedValue(mockBusiness);

      const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      await expect(
        service.createRequest(
          {
            title: 'Festival Sale',
            description: 'Huge discounts on all electronics items',
            start_date: startDate,
            end_date: endDate,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category has a live featured business', async () => {
      businessRepo.findOne.mockResolvedValue(mockBusiness);

      const startDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Mock conflicting live request
      const mockConflict = {
        id: 'req-live',
        business_id: 'biz-other',
        category_id: 'cat-123',
        status: FeaturedRequestStatus.APPROVED,
        start_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockConflict),
      };
      featuredRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      await expect(
        service.createRequest(
          {
            title: 'Summer Sale',
            description: 'Exclusive summer deals for members',
            start_date: startDate,
            end_date: endDate,
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create featured request when category has no conflicting request', async () => {
      businessRepo.findOne.mockResolvedValue(mockBusiness);

      const startDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // No conflict
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      featuredRequestRepo.createQueryBuilder.mockReturnValue(mockQb);
      featuredRequestRepo.findOne.mockResolvedValue(null); // No existing pending

      const savedResult = {
        id: 'req-new-id',
        business_id: mockBusiness.id,
        category_id: mockBusiness.category_id,
        title: 'Summer Sale',
        description: 'Exclusive summer deals for members',
        start_date: startDate,
        end_date: endDate,
        status: FeaturedRequestStatus.PENDING,
      };
      featuredRequestRepo.save.mockResolvedValue(savedResult);

      jest.spyOn(service, 'findById').mockResolvedValue(savedResult as any);

      const result = await service.createRequest(
        {
          title: 'Summer Sale',
          description: 'Exclusive summer deals for members',
          start_date: startDate,
          end_date: endDate,
        },
        mockUser,
      );

      expect(result.id).toEqual('req-new-id');
      expect(featuredRequestRepo.create).toHaveBeenCalled();
    });
  });

  describe('approveRequest', () => {
    it('should throw BadRequestException if another request is live in the category', async () => {
      const existingReq: FeaturedBusinessRequest = {
        id: 'req-to-approve',
        category_id: 'cat-123',
        business_id: 'biz-123',
        status: FeaturedRequestStatus.PENDING,
        start_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as any;

      jest.spyOn(service, 'findById').mockResolvedValue(existingReq);

      // Mock conflicting request
      const mockConflict = {
        id: 'req-other-live',
        business_id: 'biz-other',
        business: { name: 'Super Store' },
        category_id: 'cat-123',
        status: FeaturedRequestStatus.APPROVED,
        start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      };

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockConflict),
      };
      featuredRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      await expect(service.approveRequest('req-to-approve', mockAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully approve request when category is free', async () => {
      const existingReq: FeaturedBusinessRequest = {
        id: 'req-to-approve',
        category_id: 'cat-123',
        business_id: 'biz-123',
        status: FeaturedRequestStatus.PENDING,
        start_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as any;

      jest.spyOn(service, 'findById').mockResolvedValue(existingReq);

      // No conflict
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      featuredRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      businessRepo.findOne.mockResolvedValue(mockBusiness);

      featuredRequestRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      const result = await service.approveRequest('req-to-approve', mockAdmin);

      expect(result.status).toEqual(FeaturedRequestStatus.APPROVED);
      expect(result.approved_by_id).toEqual(mockAdmin.id);
    });
  });
});
