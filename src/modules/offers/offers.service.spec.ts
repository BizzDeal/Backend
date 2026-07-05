jest.mock('../../common/firebase/firebase.service', () => ({
  FirebaseService: jest.fn(),
}));
jest.mock('../media/media.service', () => ({
  MediaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { Offer } from './entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import { MediaService } from '../media/media.service';
import {
  OfferStatus,
  BusinessStatus,
  UserRole,
  OfferType,
  DiscountType,
} from '../../common/enums';
import { User } from '../users/entities/user.entity';

describe('OffersService', () => {
  let service: OffersService;
  let mockOfferRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockBusinessRepo: {
    findOne: jest.Mock;
  };
  let mockMediaService: {
    saveFile: jest.Mock;
    deleteFileById: jest.Mock;
  };

  beforeEach(async () => {
    mockOfferRepo = {
      create: jest.fn().mockImplementation((data) => ({ id: 'offer-id', ...data })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'offer-id', ...entity })),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(true),
      createQueryBuilder: jest.fn(),
    };

    mockBusinessRepo = {
      findOne: jest.fn(),
    };

    mockMediaService = {
      saveFile: jest.fn(),
      deleteFileById: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        {
          provide: getRepositoryToken(Offer),
          useValue: mockOfferRepo,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepo,
        },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockMember = { id: 'owner-id', role: UserRole.MEMBER } as User;
    const mockOtherMember = { id: 'other-id', role: UserRole.MEMBER } as User;

    it('should successfully create an offer for the owning member', async () => {
      mockBusinessRepo.findOne.mockResolvedValue({
        id: 'business-id',
        owner_id: 'owner-id',
        status: BusinessStatus.ACTIVE,
      });

      const res = await service.create(
        {
          business_id: 'business-id',
          title: 'Special Deal',
          description: 'Deal Desc',
          offer_type: OfferType.DISCOUNT,
          start_date: new Date(),
          end_date: new Date(),
        },
        mockMember,
      );

      expect(res).toBeDefined();
      expect(res.status).toBe(OfferStatus.PENDING);
      expect(mockOfferRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if member tries to create offer for another member business', async () => {
      mockBusinessRepo.findOne.mockResolvedValue({
        id: 'business-id',
        owner_id: 'owner-id',
        status: BusinessStatus.ACTIVE,
      });

      await expect(
        service.create(
          {
            business_id: 'business-id',
            title: 'Special Deal',
            description: 'Deal Desc',
            offer_type: OfferType.DISCOUNT,
            start_date: new Date(),
            end_date: new Date(),
          },
          mockOtherMember,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const mockMember = { id: 'owner-id', role: UserRole.MEMBER } as User;
    const mockOtherMember = { id: 'other-id', role: UserRole.MEMBER } as User;

    it('should forbid another member from updating an offer they do not own', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        business: { owner_id: 'owner-id' },
      });

      await expect(
        service.update('offer-id', { title: 'New Title' }, mockOtherMember),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owning member to update their offer and reset status to PENDING', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        status: OfferStatus.APPROVED,
        business: { owner_id: 'owner-id' },
      });

      const res = await service.update('offer-id', { title: 'New Title' }, mockMember);
      expect(res.status).toBe(OfferStatus.PENDING);
      expect(mockOfferRepo.save).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const mockMember = { id: 'owner-id', role: UserRole.MEMBER } as User;
    const mockOtherMember = { id: 'other-id', role: UserRole.MEMBER } as User;

    it('should forbid another member from deleting an offer they do not own', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        business: { owner_id: 'owner-id' },
      });

      await expect(service.delete('offer-id', mockOtherMember)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow owning member to delete their offer', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        business: { owner_id: 'owner-id' },
      });

      const res = await service.delete('offer-id', mockMember);
      expect(res.success).toBe(true);
      expect(mockOfferRepo.remove).toHaveBeenCalled();
    });
  });
});
