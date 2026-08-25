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
import { Profile } from '../users/entities/profile.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { CustomerBusiness } from '../businesses/entities/customer-business.entity';
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
import { SettingsService } from '../settings/settings.service';

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
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(BusinessProfile)
    private readonly businessRepository: Repository<BusinessProfile>,
    @InjectRepository(CustomerBusiness)
    private readonly customerBusinessRepository: Repository<CustomerBusiness>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly notificationsService: NotificationsService,
    private readonly appEventsGateway: AppEventsGateway,
    private readonly settingsService: SettingsService,
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
    is_featured: boolean;
    can_redeem: boolean;
    business_id: string | null;
  }> {
    if (issuer.role === UserRole.ADMIN) {
      return { has_active_offer: true, is_featured: true, can_redeem: true, business_id: null };
    }
    const business = await this.businessRepository.findOne({
      where: { owner_id: issuer.id },
    });
    if (!business) {
      return { has_active_offer: false, is_featured: false, can_redeem: false, business_id: null };
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
    const isFeatured = !!business.is_featured;
    const hasActiveOffer = !!activeOffer;
    return {
      has_active_offer: hasActiveOffer,
      is_featured: isFeatured,
      can_redeem: isFeatured || hasActiveOffer,
      business_id: business.id,
    };
  }

  async issueCoins() {
    throw new ForbiddenException(
      'Manual Bizz Coin issuance is disabled. Bizz Coins are awarded automatically through platform reward rules.',
    );
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

      if (!activeOffer && !business.is_featured) {
        throw new BadRequestException(
          'You must have a featured business or an active Bizz Coins offer to redeem Bizz Coins for customers.',
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

    const platformSettings = await this.settingsService.getSettings();
    const bizzCoinValue = Number(platformSettings?.bizz_coin_value) || 1.0;
    const redemptionRewardBonus =
      platformSettings?.customer_redemption_reward_bizz_points !== undefined &&
      platformSettings?.customer_redemption_reward_bizz_points !== null
        ? Number(platformSettings.customer_redemption_reward_bizz_points)
        : 75;

    const discountAmount = coinsToRedeem * bizzCoinValue;
    const billAmount = Number(dto.bill_amount) || 0;

    if (discountAmount > billAmount) {
      const maxAllowedCoins = Math.floor(billAmount / bizzCoinValue);
      throw new BadRequestException(
        `Coin discount amount (₹${discountAmount}) cannot exceed the total bill amount (₹${billAmount}). Maximum allowed coins for this bill: ${maxAllowedCoins}.`,
      );
    }

    const balanceAfterDebit = currentBalance - coinsToRedeem;
    const finalBalance = balanceAfterDebit + (redemptionRewardBonus > 0 ? redemptionRewardBonus : 0);
    customerWallet.balance = finalBalance;
    const finalAmountToPay = Math.max(0, Number(dto.bill_amount) - discountAmount);

    const businessName = business?.name || 'BizzDeal Partner';
    const debitDescription = `Redeemed ${coinsToRedeem} Bizz Coins (₹${discountAmount}) for a bill of ₹${dto.bill_amount} at ${businessName}`;

    const debitTx = this.transactionRepository.create({
      bizz_coin_wallet_id: customerWallet.id,
      user_id: targetCustomer.id,
      business_id: business?.id || null,
      type: BizzCoinTransactionType.DEBIT,
      amount: coinsToRedeem,
      description: debitDescription,
    });

    let rewardTx: BizzCoinTransaction | null = null;
    if (redemptionRewardBonus > 0) {
      rewardTx = this.transactionRepository.create({
        bizz_coin_wallet_id: customerWallet.id,
        user_id: targetCustomer.id,
        business_id: business?.id || null,
        type: BizzCoinTransactionType.CREDIT,
        amount: redemptionRewardBonus,
        description: `Redemption Reward: Received ${redemptionRewardBonus} Bizz Points for visiting & redeeming at ${businessName} 🎉`,
      });
    }

    const now = new Date();
    const savedDebitTx = await this.walletRepository.manager.transaction(async (manager) => {
      await manager.save(BizzCoinWallet, customerWallet);
      const savedTransaction = await manager.save(BizzCoinTransaction, debitTx);
      if (rewardTx) {
        await manager.save(BizzCoinTransaction, rewardTx);
      }

      if (business?.id) {
        // Track primary store for customer if not already set
        const profile = await manager.findOne(Profile, { where: { user_id: targetCustomer.id } });
        if (profile && !profile.primary_business_id) {
          profile.primary_business_id = business.id;
          await manager.save(Profile, profile);
        }

        // Track/update customer visits to this store
        let customerBusiness = await manager.findOne(CustomerBusiness, {
          where: { customer_id: targetCustomer.id, business_id: business.id },
        });

        if (!customerBusiness) {
          customerBusiness = manager.create(CustomerBusiness, {
            customer_id: targetCustomer.id,
            business_id: business.id,
            total_visits: 1,
            last_visited_at: now,
          });
        } else {
          customerBusiness.total_visits = Number(customerBusiness.total_visits) + 1;
          customerBusiness.last_visited_at = now;
        }
        await manager.save(CustomerBusiness, customerBusiness);
      }

      return savedTransaction;
    });

    // Notify customer real-time via WebSockets & Push
    try {
      this.appEventsGateway.emitToUser(targetCustomer.id, 'BIZZ_COINS_REDEEMED', {
        coins: coinsToRedeem,
        reward_points: redemptionRewardBonus,
        new_balance: finalBalance,
        business_name: businessName,
      });
      const bonusNotice = redemptionRewardBonus > 0 ? ` + earned ${redemptionRewardBonus} bonus Bizz Points!` : '';
      await this.notificationsService.sendBulkToUsers({
        user_ids: [targetCustomer.id],
        title: '🪙 Bizz Coins Redeemed',
        message: `You redeemed ${coinsToRedeem} Bizz Coins at ${businessName}${bonusNotice} Current Bizz Point balance: ${finalBalance}.`,
        type: NotificationType.GENERAL,
      });
    } catch (err) {
      this.logger.warn(`Failed to send coin redemption notification/event: ${err}`);
    }

    const rewardBonusMsg = redemptionRewardBonus > 0 ? ` Customer received ${redemptionRewardBonus} bonus Bizz Points for visiting!` : '';

    return {
      success: true,
      message: `${coinsToRedeem} Bizz Coins (₹${discountAmount} value) redeemed successfully.${rewardBonusMsg}`,
      transaction: savedDebitTx,
      coins_redeemed: coinsToRedeem,
      bonus_points_awarded: redemptionRewardBonus,
      new_balance: finalBalance,
      bizz_coin_value: bizzCoinValue,
      discount_amount: discountAmount,
      final_amount_to_pay: finalAmountToPay,
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

  async awardCustomerSignupBonus(userId: string): Promise<{ bonusAmount: number; transaction: BizzCoinTransaction | null }> {
    const settings = await this.settingsService.getSettings();
    const bonusAmount =
      settings?.customer_signup_bizz_points !== undefined &&
      settings?.customer_signup_bizz_points !== null
        ? Number(settings.customer_signup_bizz_points)
        : 100;

    if (bonusAmount <= 0) {
      return { bonusAmount: 0, transaction: null };
    }

    const wallet = await this.getOrCreateWallet(userId);
    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = currentBalance + bonusAmount;
    wallet.balance = newBalance;
    await this.walletRepository.save(wallet);

    const description = `Welcome Bonus: Received ${bonusAmount} Bizz Points on signup 🎉`;
    const tx = this.transactionRepository.create({
      bizz_coin_wallet_id: wallet.id,
      user_id: userId,
      business_id: null,
      type: BizzCoinTransactionType.CREDIT,
      amount: bonusAmount,
      description,
    });
    const savedTx = await this.transactionRepository.save(tx);

    try {
      this.appEventsGateway.emitToUser(userId, 'BIZZ_COINS_ISSUED', {
        coins: bonusAmount,
        new_balance: newBalance,
        business_name: 'BizzDeal Welcome Gift',
      });
      await this.notificationsService.sendBulkToUsers({
        user_ids: [userId],
        title: '🎉 Welcome to BizzDeal!',
        message: `You have received ${bonusAmount} Bizz Points as a welcome gift!`,
        type: NotificationType.GENERAL,
      });
    } catch (err) {
      this.logger.warn(`Failed to send signup bonus notification/event: ${err}`);
    }

    return {
      bonusAmount,
      transaction: savedTx,
    };
  }

  async awardMemberReferralAppreciationCoins(
    referrerId: string,
    recipientName: string,
    contactName: string,
  ): Promise<{ coinsAwarded: number; transaction: BizzCoinTransaction | null }> {
    const settings = await this.settingsService.getSettings();
    const coinsAwarded =
      settings?.member_referral_bizz_points !== undefined &&
      settings?.member_referral_bizz_points !== null
        ? Number(settings.member_referral_bizz_points)
        : 100;

    if (coinsAwarded <= 0) {
      return { coinsAwarded: 0, transaction: null };
    }

    const wallet = await this.getOrCreateWallet(referrerId);
    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = currentBalance + coinsAwarded;
    wallet.balance = newBalance;
    await this.walletRepository.save(wallet);

    const description = `Referral Appreciation: Received ${coinsAwarded} Bizz Coins for referral of ${contactName} to ${recipientName} 🎉`;
    const tx = this.transactionRepository.create({
      bizz_coin_wallet_id: wallet.id,
      user_id: referrerId,
      business_id: null,
      type: BizzCoinTransactionType.CREDIT,
      amount: coinsAwarded,
      description,
    });
    const savedTx = await this.transactionRepository.save(tx);

    try {
      this.appEventsGateway.emitToUser(referrerId, 'BIZZ_COINS_ISSUED', {
        coins: coinsAwarded,
        new_balance: newBalance,
        business_name: 'Referral Appreciation Bonus',
      });
      await this.notificationsService.sendBulkToUsers({
        user_ids: [referrerId],
        title: '🎉 Referral Appreciated & Bizz Coins Earned!',
        message: `You received ${coinsAwarded} Bizz Coins as appreciation for referring ${contactName} to ${recipientName}! Current balance: ${newBalance}.`,
        type: NotificationType.GENERAL,
      });
    } catch (err) {
      this.logger.warn(`Failed to send referral appreciation coin notification/event: ${err}`);
    }

    return {
      coinsAwarded,
      transaction: savedTx,
    };
  }
}

