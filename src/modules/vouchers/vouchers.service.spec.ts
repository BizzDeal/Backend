import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { Voucher } from './entities/voucher.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import {
  VoucherStatus,
  OfferStatus,
  BusinessStatus,
  UserRole,
  UserStatus,
  OfferType,
  DiscountType,
} from '../../common/enums';
import { User } from '../users/entities/user.entity';

describe('VouchersService', () => {
  let service: VouchersService;
  let mockManager: {
    save: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let mockVoucherRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let mockOfferRepo: {
    findOne: jest.Mock;
  };
  let mockBusinessRepo: {
    findOne: jest.Mock;
  };
  let mockUserRepo: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    mockManager = {
      save: jest
        .fn()
        .mockImplementation((cls, entity) => Promise.resolve(entity || cls)),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((cls, data) => ({ id: 'wallet-tx-id', ...data })),
    };

    mockVoucherRepo = {
      create: jest
        .fn()
        .mockImplementation((data) => ({ id: 'voucher-id', ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'voucher-id', ...entity }),
        ),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      },
    };

    mockOfferRepo = {
      findOne: jest.fn(),
    };

    mockBusinessRepo = {
      findOne: jest.fn(),
    };

    mockUserRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        {
          provide: getRepositoryToken(Voucher),
          useValue: mockVoucherRepo,
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: mockOfferRepo,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueVoucher', () => {
    const mockUser: User = {
      id: 'customer-id',
      role: UserRole.CUSTOMER,
      full_name: 'Test Customer',
      phone: '1234567890',
      whatsapp: null,
      email: 'customer@test.com',
      address: null,
      status: UserStatus.ACTIVE,
      approved_by_id: null,
      approved_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as User;

    it('should successfully issue a voucher for an active approved offer', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const prevMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        business_id: 'business-id',
        status: OfferStatus.APPROVED,
        start_date: prevMonth,
        end_date: nextMonth,
        business: { status: BusinessStatus.ACTIVE },
      });

      const res = await service.issueVoucher(
        { offer_id: 'offer-id' },
        mockUser,
      );
      expect(res).toBeDefined();
      expect(res.status).toBe(VoucherStatus.ISSUED);
      expect(res.customer_id).toBe('customer-id');
      expect(mockVoucherRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if offer is not APPROVED', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        status: OfferStatus.PENDING,
        business: { status: BusinessStatus.ACTIVE },
      });

      await expect(
        service.issueVoucher({ offer_id: 'offer-id' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if customer tries to claim for another user', async () => {
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        status: OfferStatus.APPROVED,
        start_date: new Date(Date.now() - 10000),
        end_date: new Date(Date.now() + 10000),
        business: { status: BusinessStatus.ACTIVE },
      });

      await expect(
        service.issueVoucher(
          { offer_id: 'offer-id', customer_id: 'other-customer-id' },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Member to issue voucher to a Customer for their own business', async () => {
      const mockMember = { id: 'owner-id', role: UserRole.MEMBER } as User;
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        status: OfferStatus.APPROVED,
        start_date: new Date(Date.now() - 10000),
        end_date: new Date(Date.now() + 10000),
        business: { status: BusinessStatus.ACTIVE, owner_id: 'owner-id' },
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'target-customer-id',
        role: UserRole.CUSTOMER,
      });

      const res = await service.issueVoucher(
        { offer_id: 'offer-id', customer_id: 'target-customer-id' },
        mockMember,
      );
      expect(res.customer_id).toBe('target-customer-id');
    });

    it('should throw ForbiddenException if Member tries to issue voucher for another business', async () => {
      const mockMember = { id: 'owner-id', role: UserRole.MEMBER } as User;
      mockOfferRepo.findOne.mockResolvedValue({
        id: 'offer-id',
        status: OfferStatus.APPROVED,
        start_date: new Date(Date.now() - 10000),
        end_date: new Date(Date.now() + 10000),
        business: { status: BusinessStatus.ACTIVE, owner_id: 'different-owner-id' },
      });

      await expect(
        service.issueVoucher(
          { offer_id: 'offer-id', customer_id: 'target-customer-id' },
          mockMember,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('redeemVoucher', () => {
    const mockCustomer: User = {
      id: 'customer-id',
      role: UserRole.CUSTOMER,
    } as User;
    const mockMember: User = { id: 'owner-id', role: UserRole.MEMBER } as User;

    it('should forbid a customer from self-redeeming', async () => {
      mockVoucherRepo.findOne.mockResolvedValue({
        id: 'voucher-id',
        voucher_code: 'VOU-TEST',
        status: VoucherStatus.ISSUED,
        expires_at: new Date(Date.now() + 100000),
        business: { owner_id: 'owner-id' },
      });

      await expect(
        service.redeemVoucher({ voucher_code: 'VOU-TEST' }, mockCustomer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow business owner to redeem and credit cashback to wallet', async () => {
      mockVoucherRepo.findOne.mockResolvedValue({
        id: 'voucher-id',
        voucher_code: 'VOU-TEST',
        customer_id: 'customer-id',
        status: VoucherStatus.ISSUED,
        expires_at: new Date(Date.now() + 100000),
        business: { owner_id: 'owner-id' },
        offer: {
          title: 'Cashback Offer',
          offer_type: OfferType.CASHBACK,
          discount_value: 50,
          discount_type: DiscountType.FIXED_AMOUNT,
        },
      });

      const res = await service.redeemVoucher(
        { voucher_code: 'VOU-TEST' },
        mockMember,
      );
      expect(res.status).toBe(VoucherStatus.REDEEMED);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should push remaining voucher balance into wallet balance when bill_amount is less than fixed discount value', async () => {
      mockVoucherRepo.findOne.mockResolvedValue({
        id: 'voucher-id',
        voucher_code: 'VOU-FIXED-1000',
        customer_id: 'customer-id',
        status: VoucherStatus.ISSUED,
        expires_at: new Date(Date.now() + 100000),
        business: { owner_id: 'owner-id' },
        offer: {
          title: '1000 Store Credit',
          offer_type: OfferType.DISCOUNT,
          discount_value: 1000,
          discount_type: DiscountType.FIXED_AMOUNT,
        },
      });

      const res = await service.redeemVoucher(
        { voucher_code: 'VOU-FIXED-1000', bill_amount: 200 },
        mockMember,
      );
      expect(res.status).toBe(VoucherStatus.REDEEMED);
      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 800,
          description: expect.stringContaining('Remaining voucher balance credited'),
        }),
      );
    });
  });
});
