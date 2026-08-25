import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { BizzCoinsService } from './bizz-coins.service';
import { BizzCoinWallet } from './entities/bizz-coin-wallet.entity';
import { BizzCoinTransaction } from './entities/bizz-coin-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { CustomerBusiness } from '../businesses/entities/customer-business.entity';
import { Offer } from '../offers/entities/offer.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AppEventsGateway } from '../events/events.gateway';
import { SettingsService } from '../settings/settings.service';
import { UserRole, OfferType, OfferStatus } from '../../common/enums';

describe('BizzCoinsService', () => {
  let service: BizzCoinsService;
  let mockManager: any;
  let mockWalletRepo: any;
  let mockTxRepo: any;
  let mockUserRepo: any;
  let mockProfileRepo: any;
  let mockBusinessRepo: any;
  let mockCustomerBusinessRepo: any;
  let mockOfferRepo: any;
  let mockMediaRepo: any;

  beforeEach(async () => {
    mockManager = {
      save: jest
        .fn()
        .mockImplementation((cls, entity) => Promise.resolve(entity || cls)),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((cls, data) => ({ id: 'new-id', ...data })),
    };

    mockWalletRepo = {
      findOne: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data) => ({ id: 'wallet-id', ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve(entity)),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      },
    };

    mockTxRepo = {
      create: jest
        .fn()
        .mockImplementation((data) => ({ id: 'tx-id', ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockUserRepo = {
      findOne: jest.fn(),
    };

    mockProfileRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockBusinessRepo = {
      findOne: jest.fn(),
    };

    mockCustomerBusinessRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockOfferRepo = {
      findOne: jest.fn(),
    };

    mockMediaRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BizzCoinsService,
        { provide: getRepositoryToken(BizzCoinWallet), useValue: mockWalletRepo },
        { provide: getRepositoryToken(BizzCoinTransaction), useValue: mockTxRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Profile), useValue: mockProfileRepo },
        { provide: getRepositoryToken(BusinessProfile), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(CustomerBusiness), useValue: mockCustomerBusinessRepo },
        { provide: getRepositoryToken(Offer), useValue: mockOfferRepo },
        { provide: getRepositoryToken(MediaFile), useValue: mockMediaRepo },
        {
          provide: NotificationsService,
          useValue: { sendBulkToUsers: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: AppEventsGateway,
          useValue: { emitToUser: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: { getSettings: jest.fn().mockResolvedValue({ bizz_coin_value: 1.0 }) },
        },
      ],
    }).compile();

    service = module.get<BizzCoinsService>(BizzCoinsService);
  });

  describe('redeemCoins', () => {
    const mockMember: User = {
      id: 'member-1',
      email: 'member@test.com',
      phone: '1234567890',
      role: UserRole.MEMBER,
    } as any;

    const mockCustomer: User = {
      id: 'cust-1',
      email: 'cust@test.com',
      phone: '9876543210',
      role: UserRole.CUSTOMER,
      profile: {
        id: 'profile-1',
        full_name: 'Test Customer',
        primary_business_id: null,
      } as any,
    } as any;

    const mockBusiness = {
      id: 'bus-1',
      owner_id: 'member-1',
      name: 'Test Store',
      is_featured: true,
    };

    it('should throw ForbiddenException if customer attempts to redeem', async () => {
      await expect(
        service.redeemCoins({ customer_phone: '9876543210', coins: 10, bill_amount: 100 }, mockCustomer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set primary store and track customer visit when customer has no primary store', async () => {
      mockBusinessRepo.findOne.mockResolvedValue(mockBusiness);
      mockUserRepo.findOne.mockResolvedValue(mockCustomer);
      mockWalletRepo.findOne.mockResolvedValue({ id: 'wallet-1', user_id: 'cust-1', balance: 50 });

      mockManager.findOne.mockImplementation((cls: any, opts: any) => {
        if (cls === Profile) {
          return Promise.resolve({
            id: 'profile-1',
            user_id: 'cust-1',
            primary_business_id: null,
          });
        }
        if (cls === CustomerBusiness) {
          return Promise.resolve(null); // First visit
        }
        return Promise.resolve(null);
      });

      const result = await service.redeemCoins(
        { customer_phone: '9876543210', coins: 10, bill_amount: 100 },
        mockMember,
      );

      expect(result.success).toBe(true);
      expect(result.bonus_points_awarded).toBe(75);
      expect(result.new_balance).toBe(50 - 10 + 75);
      expect(mockManager.save).toHaveBeenCalledWith(
        Profile,
        expect.objectContaining({ primary_business_id: 'bus-1' }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        CustomerBusiness,
        expect.objectContaining({
          customer_id: 'cust-1',
          business_id: 'bus-1',
          total_visits: 1,
        }),
      );
    });
  });

  describe('issueCoins', () => {
    it('should throw ForbiddenException as manual issuance is disabled', async () => {
      await expect(service.issueCoins()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('awardCustomerSignupBonus', () => {
    it('should award configured signup bonus to customer wallet and create transaction', async () => {
      mockWalletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        user_id: 'cust-1',
        balance: 0,
      });

      const result = await service.awardCustomerSignupBonus('cust-1');

      expect(result.bonusAmount).toBe(100);
      expect(mockWalletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wallet-1',
          user_id: 'cust-1',
          balance: 100,
        }),
      );
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bizz_coin_wallet_id: 'wallet-1',
          user_id: 'cust-1',
          amount: 100,
        }),
      );
      expect(mockTxRepo.save).toHaveBeenCalled();
    });
  });
});
