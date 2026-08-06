import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BizzCoinWallet } from './entities/bizz-coin-wallet.entity';
import {
  BizzCoinTransaction,
  BizzCoinTransactionType,
} from './entities/bizz-coin-transaction.entity';
import { User } from '../users/entities/user.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { Offer } from '../offers/entities/offer.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { IssueBizzCoinsDto, RedeemBizzCoinsDto } from './schemas/bizz-coins.schema';
import {
  UserRole,
  NotificationType,
  OfferType,
  OfferStatus,
  MediaPurpose,
} from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { AppEventsGateway } from '../events/events.gateway';

@Injectable()
export class BizzCoinsService {
  private readonly logger = new Logger(BizzCoinsService.name);

  constructor(
    @InjectRepository(BizzCoinWallet)
    private readonly walletRepository: Repository<BizzCoinWallet>,
    @InjectRepository(BizzCoinTransaction)
    private readonly transactionRepository: Repository<BizzCoinTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BusinessProfile)
    private readonly businessRepository: Repository<BusinessProfile>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly notificationsService: NotificationsService,
    private readonly appEventsGateway: AppEventsGateway,
  ) {}

  async getOrCreateWallet(userId: string): Promise<BizzCoinWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) {
      wallet = this.walletRepository.create({
        user_id: userId,
        balance: 0,
      });
      wallet = await this.walletRepository.save(wallet);
    }
    return wallet;
  }

  async checkMemberActiveBizzCoinOffer(issuer: User): Promise<{
    has_active_offer: boolean;
    business_id: string | null;
  }> {
    if (issuer.role === UserRole.ADMIN) {
      return { has_active_offer: true, business_id: null };
    }
    const business = await this.businessRepository.findOne({
      where: { owner_id: issuer.id },
    });
    if (!business) {
      return { has_active_offer: false, business_id: null };
    }
    const now = new Date();
    const activeOffer = await this.offerRepository.findOne({
      where: {
        business_id: business.id,
        offer_type: OfferType.BIZZ_COINS,
        status: OfferStatus.APPROVED,
        start_date: LessThanOrEqual(now),
        end_date: MoreThanOrEqual(now),
      },
    });
    return { has_active_offer: !!activeOffer, business_id: business.id };
  }

  async issueCoins(dto: IssueBizzCoinsDto, issuer: User) {
    if (issuer.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot issue Bizz Coins');
    }

    const targetCustomer = await this.userRepository.findOne({
      where: { phone: dto.customer_phone },
      relations: { profile: true },
    });

    if (!targetCustomer) {
      throw new NotFoundException(
        `No registered customer found with phone number ${dto.customer_phone}`,
      );
    }

    if (targetCustomer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Bizz Coins can only be issued to customers');
    }

    let business: BusinessProfile | null = null;
    if (issuer.role === UserRole.MEMBER) {
      business = await this.businessRepository.findOne({
        where: { owner_id: issuer.id },
      });
      if (!business) {
        throw new BadRequestException(
          'Member business profile not found. Cannot issue Bizz Coins.',
        );
      }
    }

    const coinsToIssue = Number(dto.coins);
    if (isNaN(coinsToIssue) || coinsToIssue <= 0) {
      throw new BadRequestException('Coins amount must be a positive number');
    }

    const customerWallet = await this.getOrCreateWallet(targetCustomer.id);
    const currentBalance = Number(customerWallet.balance) || 0;
    const newBalance = currentBalance + coinsToIssue;

    customerWallet.balance = newBalance;
    await this.walletRepository.save(customerWallet);

    const businessName = business?.name || 'BizzDeal Partner';
    const description =
      dto.description || `Received ${coinsToIssue} Bizz Coins from ${businessName}`;

    const tx = this.transactionRepository.create({
      bizz_coin_wallet_id: customerWallet.id,
      user_id: targetCustomer.id,
      business_id: business?.id || null,
      type: BizzCoinTransactionType.CREDIT,
      amount: coinsToIssue,
      description,
    });
    const savedTx = await this.transactionRepository.save(tx);

    // Notify customer real-time via WebSockets & Push
    try {
      this.appEventsGateway.emitToUser(targetCustomer.id, 'BIZZ_COINS_ISSUED', {
        coins: coinsToIssue,
        new_balance: newBalance,
        business_name: businessName,
      });
      await this.notificationsService.sendBulkToUsers({
        user_ids: [targetCustomer.id],
        title: '🪙 Bizz Coins Received!',
        message: `You have received ${coinsToIssue} Bizz Coins from ${businessName}. New Bizz Coin balance: ${newBalance}.`,
        type: NotificationType.GENERAL,
      });
    } catch (err) {
      this.logger.warn(`Failed to send coin notification/event: ${err}`);
    }

    return {
      success: true,
      message: `${coinsToIssue} Bizz Coins issued successfully to ${targetCustomer.profile?.full_name || 'Customer'}.`,
      transaction: savedTx,
      new_balance: newBalance,
      customer: {
        id: targetCustomer.id,
        name: targetCustomer.profile?.full_name || 'Customer',
        phone: targetCustomer.phone,
      },
    };
  }

  async redeemCoins(dto: RedeemBizzCoinsDto, issuer: User) {
    if (issuer.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot redeem Bizz Coins');
    }

    let business: BusinessProfile | null = null;
    if (issuer.role === UserRole.MEMBER) {
      business = await this.businessRepository.findOne({
        where: { owner_id: issuer.id },
      });
      if (!business) {
        throw new BadRequestException(
          'Member business profile not found. Cannot redeem Bizz Coins.',
        );
      }

      // Check if member has an active Bizz Coins offer
      const now = new Date();
      const activeOffer = await this.offerRepository.findOne({
        where: {
          business_id: business.id,
          offer_type: OfferType.BIZZ_COINS,
          status: OfferStatus.APPROVED,
          start_date: LessThanOrEqual(now),
          end_date: MoreThanOrEqual(now),
        },
      });

      if (!activeOffer) {
        throw new BadRequestException(
          'You must have an active Bizz Coins offer to redeem Bizz Coins for customers.',
        );
      }
    }

    const targetCustomer = await this.userRepository.findOne({
      where: { phone: dto.customer_phone },
      relations: { profile: true },
    });

    if (!targetCustomer) {
      throw new NotFoundException(
        `No registered customer found with phone number ${dto.customer_phone}`,
      );
    }

    if (targetCustomer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Bizz Coins can only be redeemed for customers');
    }

    const coinsToRedeem = Number(dto.coins);
    if (isNaN(coinsToRedeem) || coinsToRedeem <= 0) {
      throw new BadRequestException('Coins amount must be a positive number');
    }

    const customerWallet = await this.getOrCreateWallet(targetCustomer.id);
    const currentBalance = Number(customerWallet.balance) || 0;

    if (coinsToRedeem > currentBalance) {
      throw new BadRequestException(
        `Customer has insufficient Bizz Coins balance. Available: ${currentBalance}, Requested: ${coinsToRedeem}`,
      );
    }

    const newBalance = currentBalance - coinsToRedeem;
    customerWallet.balance = newBalance;
    await this.walletRepository.save(customerWallet);

    const businessName = business?.name || 'BizzDeal Partner';
    const description = `Redeemed ${coinsToRedeem} Bizz Coins for a bill of ₹${dto.bill_amount} at ${businessName}`;

    const tx = this.transactionRepository.create({
      bizz_coin_wallet_id: customerWallet.id,
      user_id: targetCustomer.id,
      business_id: business?.id || null,
      type: BizzCoinTransactionType.DEBIT,
      amount: coinsToRedeem,
      description,
    });
    const savedTx = await this.transactionRepository.save(tx);

    // Notify customer real-time via WebSockets & Push
    try {
      this.appEventsGateway.emitToUser(targetCustomer.id, 'BIZZ_COINS_REDEEMED', {
        coins: coinsToRedeem,
        new_balance: newBalance,
        business_name: businessName,
      });
      await this.notificationsService.sendBulkToUsers({
        user_ids: [targetCustomer.id],
        title: '🪙 Bizz Coins Redeemed',
        message: `You redeemed ${coinsToRedeem} Bizz Coins at ${businessName}. Remaining Bizz Coin balance: ${newBalance}.`,
        type: NotificationType.GENERAL,
      });
    } catch (err) {
      this.logger.warn(`Failed to send coin redemption notification/event: ${err}`);
    }

    return {
      success: true,
      message: `${coinsToRedeem} Bizz Coins redeemed successfully for ${targetCustomer.profile?.full_name || 'Customer'}.`,
      transaction: savedTx,
      new_balance: newBalance,
      customer: {
        id: targetCustomer.id,
        name: targetCustomer.profile?.full_name || 'Customer',
        phone: targetCustomer.phone,
      },
    };
  }

  async getCustomerCoinWalletByPhone(phone: string, issuer: User) {
    const targetCustomer = await this.userRepository.findOne({
      where: { phone },
      relations: { profile: true },
    });

    if (!targetCustomer) {
      throw new NotFoundException(
        `No registered customer found with phone number ${phone}`,
      );
    }

    if (targetCustomer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Target phone number does not belong to a customer');
    }

    const profilePic = await this.mediaRepository.findOne({
      where: {
        uploaded_by_id: targetCustomer.id,
        purpose: MediaPurpose.PROFILE_PIC,
      },
      order: { created_at: 'DESC' },
    });

    const { has_active_offer } = await this.checkMemberActiveBizzCoinOffer(issuer);
    const wallet = await this.getOrCreateWallet(targetCustomer.id);

    return {
      id: targetCustomer.id,
      name: targetCustomer.profile?.full_name || 'Customer',
      phone: targetCustomer.phone,
      email: targetCustomer.email,
      profile_pic_url: profilePic?.file_url || null,
      coins_balance: Number(wallet.balance) || 0,
      has_active_bizz_coin_offer: has_active_offer,
    };
  }

  async getMyCoinsWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await this.transactionRepository.find({
      where: { user_id: userId },
      relations: { business: true },
      order: { created_at: 'DESC' },
      take: 20,
    });

    return {
      coins_balance: Number(wallet.balance) || 0,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        business_name: t.business?.name || 'BizzDeal Partner',
        created_at: t.created_at,
      })),
    };
  }
}

