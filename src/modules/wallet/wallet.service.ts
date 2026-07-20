import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import {
  CreditWalletDto,
  DebitWalletDto,
  WalletQueryDto,
} from './schemas/wallet.schema';
import {
  WalletTransactionType,
  WalletReferenceType,
  UserRole,
} from '../../common/enums';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getBalance(userId?: string, currentUser?: User): Promise<Wallet> {
    const targetId = userId || currentUser?.id;
    if (!targetId) {
      throw new BadRequestException('User ID is required');
    }

    if (
      userId &&
      currentUser &&
      userId !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this wallet balance',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: targetId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let wallet = await this.walletRepository.findOne({
      where: { user_id: targetId },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        user_id: targetId,
        balance: 0,
        total_savings: 0,
      });
      wallet = await this.walletRepository.save(wallet);
    }

    return wallet;
  }

  async getHistory(
    query: WalletQueryDto,
    currentUser: User,
  ): Promise<WalletTransaction[]> {
    if (
      query.user_id &&
      query.user_id !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins can view other users transaction history',
      );
    }

    const qb = this.transactionRepository.createQueryBuilder('tx');

    if (currentUser.role !== UserRole.ADMIN) {
      qb.andWhere('tx.user_id = :userId', { userId: currentUser.id });
    } else if (query.user_id) {
      qb.andWhere('tx.user_id = :userId', { userId: query.user_id });
    }

    if (query.type) {
      qb.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.reference_type) {
      qb.andWhere('tx.reference_type = :refType', {
        refType: query.reference_type,
      });
    }

    if (query.states || query.districts) {
      qb.leftJoin('tx.user', 'user');
      if (query.states) {
        qb.andWhere('user.state_id IN (:...states)', {
          states: query.states.split(','),
        });
      }
      if (query.districts) {
        qb.andWhere('user.district_id IN (:...districts)', {
          districts: query.districts.split(','),
        });
      }
    }

    qb.orderBy('tx.created_at', 'DESC');
    return qb.getMany();
  }

  async getSavings(
    query: WalletQueryDto,
    currentUser: User,
  ): Promise<WalletTransaction[]> {
    if (
      query.user_id &&
      query.user_id !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins can view other users savings history',
      );
    }

    const qb = this.transactionRepository.createQueryBuilder('tx');

    if (currentUser.role !== UserRole.ADMIN) {
      qb.andWhere('tx.user_id = :userId', { userId: currentUser.id });
    } else if (query.user_id) {
      qb.andWhere('tx.user_id = :userId', { userId: query.user_id });
    }

    qb.andWhere('tx.type = :type', { type: WalletTransactionType.SAVING });

    if (query.reference_type) {
      qb.andWhere('tx.reference_type = :refType', {
        refType: query.reference_type,
      });
    }

    if (query.states || query.districts) {
      qb.leftJoin('tx.user', 'user');
      if (query.states) {
        qb.andWhere('user.state_id IN (:...states)', {
          states: query.states.split(','),
        });
      }
      if (query.districts) {
        qb.andWhere('user.district_id IN (:...districts)', {
          districts: query.districts.split(','),
        });
      }
    }

    qb.orderBy('tx.created_at', 'DESC');
    return qb.getMany();
  }

  async creditWallet(
    dto: CreditWalletDto,
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const user = await this.userRepository.findOne({
      where: { id: dto.user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.walletRepository.manager.transaction(async (manager) => {
      let wallet = await manager.findOne(Wallet, {
        where: { user_id: dto.user_id },
      });
      if (!wallet) {
        wallet = manager.create(Wallet, {
          user_id: dto.user_id,
          balance: 0,
          total_savings: 0,
        });
      }

      wallet.balance = Number(wallet.balance) + Number(dto.amount);
      const savedWallet = await manager.save(Wallet, wallet);

      const tx = manager.create(WalletTransaction, {
        wallet_id: savedWallet.id,
        user_id: dto.user_id,
        type: WalletTransactionType.CREDIT,
        amount: Number(dto.amount),
        description: dto.description || 'Wallet balance credited by Admin',
        reference_type: dto.reference_type || WalletReferenceType.MANUAL,
        reference_id: dto.reference_id || null,
      });
      const savedTx = await manager.save(WalletTransaction, tx);
      await this.analyticsService.trackWalletTransaction(
        WalletTransactionType.CREDIT,
        Number(dto.amount),
      );

      return { wallet: savedWallet, transaction: savedTx };
    });
  }

  async debitWallet(
    dto: DebitWalletDto,
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const user = await this.userRepository.findOne({
      where: { id: dto.user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.walletRepository.manager.transaction(async (manager) => {
      let wallet = await manager.findOne(Wallet, {
        where: { user_id: dto.user_id },
      });
      if (!wallet) {
        wallet = manager.create(Wallet, {
          user_id: dto.user_id,
          balance: 0,
          total_savings: 0,
        });
        await manager.save(Wallet, wallet);
      }

      if (Number(wallet.balance) < Number(dto.amount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      wallet.balance = Number(wallet.balance) - Number(dto.amount);
      const savedWallet = await manager.save(Wallet, wallet);

      const tx = manager.create(WalletTransaction, {
        wallet_id: savedWallet.id,
        user_id: dto.user_id,
        type: WalletTransactionType.DEBIT,
        amount: Number(dto.amount),
        description: dto.description || 'Wallet balance debited by Admin',
        reference_type: dto.reference_type || WalletReferenceType.MANUAL,
        reference_id: dto.reference_id || null,
      });
      const savedTx = await manager.save(WalletTransaction, tx);
      await this.analyticsService.trackWalletTransaction(
        WalletTransactionType.DEBIT,
        Number(dto.amount),
      );

      return { wallet: savedWallet, transaction: savedTx };
    });
  }

  async getTransactionById(
    id: string,
    currentUser: User,
  ): Promise<WalletTransaction> {
    const tx = await this.transactionRepository.findOne({ where: { id } });
    if (!tx) {
      throw new NotFoundException('Wallet transaction not found');
    }

    if (tx.user_id !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to view this transaction',
      );
    }

    return tx;
  }

  async getWalletById(id: string, currentUser: User): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (
      wallet.user_id !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this wallet',
      );
    }

    return wallet;
  }
}
