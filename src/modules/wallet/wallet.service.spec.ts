import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import {
  UserRole,
  UserStatus,
  WalletTransactionType,
  WalletReferenceType,
} from '../../common/enums';

describe('WalletService', () => {
  let service: WalletService;
  let mockManager: {
    save: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let mockWalletRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let mockTransactionRepo: {
    createQueryBuilder: jest.Mock;
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
        .mockImplementation((cls, data) => ({ id: 'tx-id', ...data })),
    };

    mockWalletRepo = {
      create: jest
        .fn()
        .mockImplementation((data) => ({ id: 'wallet-id', ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'wallet-id', ...entity }),
        ),
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      },
    };

    mockTransactionRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockUserRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepo,
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    const mockCustomer: User = {
      id: 'user-1',
      role: UserRole.CUSTOMER,
      full_name: 'Test User',
      phone: '1234567890',
      whatsapp: null,
      email: 'test@test.com',
      address: null,
      status: UserStatus.ACTIVE,
      approved_by_id: null,
      approved_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as User;

    it('should initialize and save a new wallet with 0 balance if none exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockCustomer);
      mockWalletRepo.findOne.mockResolvedValue(null);

      const res = await service.getBalance(undefined, mockCustomer);
      expect(res).toBeDefined();
      expect(res.balance).toBe(0);
      expect(res.total_savings).toBe(0);
      expect(mockWalletRepo.save).toHaveBeenCalled();
    });

    it('should forbid customer from viewing another users wallet', async () => {
      await expect(
        service.getBalance('other-user-id', mockCustomer),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('creditWallet', () => {
    it('should credit wallet balance inside atomic transaction', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1' });
      mockManager.findOne.mockResolvedValue({
        id: 'wallet-1',
        user_id: 'user-1',
        balance: 100,
        total_savings: 0,
      });

      const res = await service.creditWallet({
        user_id: 'user-1',
        amount: 500,
        description: 'Test Promo',
      });
      expect(res.wallet.balance).toBe(600);
      expect(res.transaction.type).toBe(WalletTransactionType.CREDIT);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('debitWallet', () => {
    it('should debit wallet balance when balance is sufficient', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1' });
      mockManager.findOne.mockResolvedValue({
        id: 'wallet-1',
        user_id: 'user-1',
        balance: 500,
        total_savings: 0,
      });

      const res = await service.debitWallet({
        user_id: 'user-1',
        amount: 200,
      });
      expect(res.wallet.balance).toBe(300);
      expect(res.transaction.type).toBe(WalletTransactionType.DEBIT);
    });

    it('should strictly reject debit with BadRequestException when balance is insufficient', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1' });
      mockManager.findOne.mockResolvedValue({
        id: 'wallet-1',
        user_id: 'user-1',
        balance: 100,
        total_savings: 0,
      });

      await expect(
        service.debitWallet({
          user_id: 'user-1',
          amount: 500,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
