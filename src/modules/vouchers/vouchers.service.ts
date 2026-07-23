import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { Voucher } from './entities/voucher.entity';
import { Offer } from '../offers/entities/offer.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { CustomerBusiness } from '../businesses/entities/customer-business.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import {
  VoucherQueryDto,
  IssueVoucherDto,
  RedeemVoucherDto,
} from './schemas/vouchers.schema';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  VoucherStatus,
  OfferStatus,
  BusinessStatus,
  UserRole,
  OfferType,
  DiscountType,
  WalletTransactionType,
  WalletReferenceType,
  MediaPurpose,
} from '../../common/enums';
import { AnalyticsService } from '../analytics/analytics.service';
import { AppEventsGateway } from '../events/events.gateway';

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepository: Repository<Voucher>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(BusinessProfile)
    private readonly businessRepository: Repository<BusinessProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly analyticsService: AnalyticsService,
    private readonly appEventsGateway: AppEventsGateway,
  ) {}

  private generateVoucherCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `VOU-${timestamp}-${random}`;
  }

  async issueVoucher(dto: IssueVoucherDto, user: User): Promise<Voucher> {
    const offer = await this.offerRepository.findOne({
      where: { id: dto.offer_id },
      relations: { business: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== OfferStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved offers can be issued as vouchers',
      );
    }

    if (offer.business?.status !== BusinessStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot issue vouchers for an inactive business',
      );
    }

    if (user.role === UserRole.MEMBER && offer.business?.owner_id !== user.id) {
      throw new ForbiddenException(
        'Members can only issue vouchers for offers belonging to their own business',
      );
    }

    const now = new Date();
    if (now < offer.start_date || now > offer.end_date) {
      throw new BadRequestException('Offer is not currently active');
    }

    let targetCustomerId = user.id;

    if (user.role === UserRole.CUSTOMER) {
      if (dto.customer_phone && dto.customer_phone !== user.phone) {
        throw new ForbiddenException(
          'Customers can only claim vouchers for themselves',
        );
      }
      targetCustomerId = user.id;
    } else {
      if (!dto.customer_phone) {
        throw new BadRequestException(
          'customer_phone is required when issuing a voucher as a Member or Admin',
        );
      }
      const targetCustomer = await this.userRepository.findOne({
        where: { phone: dto.customer_phone },
      });
      if (!targetCustomer) {
        throw new NotFoundException('Customer not found');
      }
      if (targetCustomer.role !== UserRole.CUSTOMER) {
        throw new BadRequestException(
          'Vouchers can only be issued to users with CUSTOMER role',
        );
      }
      targetCustomerId = targetCustomer.id;
    }

    const voucherCode = this.generateVoucherCode();

    const voucher = this.voucherRepository.create({
      voucher_code: voucherCode,
      offer_id: offer.id,
      customer_id: targetCustomerId,
      business_id: offer.business_id,
      status: VoucherStatus.ISSUED,
      issued_at: now,
    });

    const savedVoucher = await this.voucherRepository.save(voucher);
    await this.analyticsService.trackVoucherIssued();
    delete (savedVoucher as any).offer;
    delete (savedVoucher as any).business;
    delete (savedVoucher as any).customer;
    delete (savedVoucher as any).redeemed_by;
    return savedVoucher;
  }

  async redeemVoucher(dto: RedeemVoucherDto, user: User): Promise<Voucher> {
    const voucher = await this.voucherRepository.findOne({
      where: { voucher_code: dto.voucher_code },
      relations: { offer: true, business: true, customer: true },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    if (voucher.status === VoucherStatus.REDEEMED) {
      throw new BadRequestException('Voucher has already been redeemed');
    }

    if (voucher.status === VoucherStatus.CANCELLED) {
      throw new BadRequestException('Voucher is cancelled');
    }

    const now = new Date();

    const isAdmin = user.role === UserRole.ADMIN;
    const isMember = user.role === UserRole.MEMBER && user.status === UserStatus.ACTIVE;
    const isBusinessOwner = voucher.business?.owner_id === user.id;

    if (!isAdmin && !isMember && !isBusinessOwner) {
      throw new ForbiddenException(
        'Only active members or an admin can redeem this voucher',
      );
    }

    return this.voucherRepository.manager.transaction(async (manager) => {
      voucher.status = VoucherStatus.REDEEMED;
      voucher.redeemed_at = now;
      voucher.redeemed_by_id = user.id;
      const savedVoucher = await manager.save(Voucher, voucher);

      // Track primary store and customer visits
      if (voucher.customer_id) {
        const profile = await manager.findOne(Profile, { where: { user_id: voucher.customer_id } });
        if (profile && !profile.primary_business_id) {
          profile.primary_business_id = voucher.business_id;
          await manager.save(Profile, profile);
        }

        let customerBusiness = await manager.findOne(CustomerBusiness, {
          where: { customer_id: voucher.customer_id, business_id: voucher.business_id },
        });

        if (!customerBusiness) {
          customerBusiness = manager.create(CustomerBusiness, {
            customer_id: voucher.customer_id,
            business_id: voucher.business_id,
            total_visits: 1,
            last_visited_at: now,
          });
        } else {
          customerBusiness.total_visits = Number(customerBusiness.total_visits) + 1;
          customerBusiness.last_visited_at = now;
        }
        await manager.save(CustomerBusiness, customerBusiness);
      }

      let calculatedAmount = 0;
      let remainingAmount = 0;
      const { offer } = voucher;

      if (offer.discount_value && offer.discount_value > 0) {
        const totalValue = Number(offer.discount_value);
        if (offer.discount_type === DiscountType.PERCENTAGE) {
          if (dto.bill_amount && dto.bill_amount > 0) {
            calculatedAmount = (dto.bill_amount * totalValue) / 100;
          }
        } else {
          if (offer.offer_type === OfferType.CASHBACK) {
            calculatedAmount = totalValue;
          } else {
            if (
              dto.bill_amount &&
              dto.bill_amount > 0 &&
              dto.bill_amount < totalValue
            ) {
              calculatedAmount = dto.bill_amount;
              remainingAmount = totalValue - dto.bill_amount;
            } else {
              calculatedAmount = totalValue;
            }
          }
        }
      }

      if (
        calculatedAmount > 0 ||
        remainingAmount > 0 ||
        (dto.wallet_amount_to_use && dto.wallet_amount_to_use > 0)
      ) {
        let wallet = await manager.findOne(Wallet, {
          where: { user_id: voucher.customer_id },
        });

        if (!wallet) {
          wallet = manager.create(Wallet, {
            user_id: voucher.customer_id,
            balance: 0,
            total_savings: 0,
          });
          wallet = await manager.save(Wallet, wallet);
        }

        if (calculatedAmount > 0) {
          const txType =
            offer.offer_type === OfferType.CASHBACK
              ? WalletTransactionType.CREDIT
              : WalletTransactionType.SAVING;

          if (txType === WalletTransactionType.CREDIT) {
            wallet.balance = Number(wallet.balance) + calculatedAmount;
          } else {
            wallet.total_savings =
              Number(wallet.total_savings) + calculatedAmount;
          }
          wallet = await manager.save(Wallet, wallet);

          const walletTx = manager.create(WalletTransaction, {
            wallet_id: wallet.id,
            user_id: voucher.customer_id,
            type: txType,
            amount: calculatedAmount,
            description: `Voucher redeemed: ${offer.title} (${voucher.voucher_code})`,
            reference_type: WalletReferenceType.VOUCHER,
            reference_id: savedVoucher.id,
          });

          await manager.save(WalletTransaction, walletTx);
        }

        if (remainingAmount > 0) {
          wallet.balance = Number(wallet.balance) + remainingAmount;
          wallet = await manager.save(Wallet, wallet);

          const remainingTx = manager.create(WalletTransaction, {
            wallet_id: wallet.id,
            user_id: voucher.customer_id,
            type: WalletTransactionType.CREDIT,
            amount: remainingAmount,
            description: `Remaining voucher balance credited to wallet: ${offer.title} (${voucher.voucher_code})`,
            reference_type: WalletReferenceType.VOUCHER,
            reference_id: savedVoucher.id,
          });

          await manager.save(WalletTransaction, remainingTx);
        }

        if (dto.wallet_amount_to_use && dto.wallet_amount_to_use > 0) {
          const walletUseAmount = Number(dto.wallet_amount_to_use);
          if (Number(wallet.balance) < walletUseAmount) {
            throw new BadRequestException(
              'Insufficient wallet balance to cover requested wallet amount',
            );
          }

          if (dto.bill_amount && dto.bill_amount > 0) {
            const remainingBill = Number(dto.bill_amount) - calculatedAmount;
            if (walletUseAmount > remainingBill) {
              throw new BadRequestException(
                'Wallet amount to use cannot exceed the remaining bill amount after voucher discount',
              );
            }
          }

          wallet.balance = Number(wallet.balance) - walletUseAmount;
          wallet = await manager.save(Wallet, wallet);

          const debitTx = manager.create(WalletTransaction, {
            wallet_id: wallet.id,
            user_id: voucher.customer_id,
            type: WalletTransactionType.DEBIT,
            amount: walletUseAmount,
            description: `Wallet balance used during voucher redemption: ${offer.title} (${voucher.voucher_code})`,
            reference_type: WalletReferenceType.VOUCHER,
            reference_id: savedVoucher.id,
          });

          await manager.save(WalletTransaction, debitTx);
        }
      }

      await this.analyticsService.trackVoucherRedeemed(
        calculatedAmount || Number(offer.discount_value || 0),
      );

      // Emit event to customer in real-time
      this.appEventsGateway.emitToUser(voucher.customer_id, 'VOUCHER_REDEEMED', {
        voucher_id: savedVoucher.id,
        voucher_code: savedVoucher.voucher_code,
        status: VoucherStatus.REDEEMED,
      });

      delete (savedVoucher as any).offer;
      delete (savedVoucher as any).business;
      delete (savedVoucher as any).customer;
      delete (savedVoucher as any).redeemed_by;
      return savedVoucher;
    });
  }
  async findAll(query: VoucherQueryDto, user?: User): Promise<PaginatedResponseDto<any>> {
    const qb = this.voucherRepository.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.business', 'business');
    qb.leftJoinAndSelect('voucher.offer', 'offer');
    qb.leftJoinAndSelect('voucher.customer', 'customer');
    qb.leftJoinAndSelect('customer.profile', 'profile');

    if (query.status) {
      qb.andWhere('voucher.status = :status', { status: query.status });
    }
    if (query.customer_id) {
      qb.andWhere('voucher.customer_id = :customerId', {
        customerId: query.customer_id,
      });
    }
    if (query.business_id) {
      qb.andWhere('voucher.business_id = :businessId', {
        businessId: query.business_id,
      });
    }
    if (query.offer_id) {
      qb.andWhere('voucher.offer_id = :offerId', { offerId: query.offer_id });
    }
    if (query.voucher_code) {
      qb.andWhere('voucher.voucher_code ILIKE :code', {
        code: `%${query.voucher_code}%`,
      });
    }

    if (query.states || query.districts) {
      qb.leftJoin('business.owner', 'owner');
      if (query.states) {
        qb.andWhere('owner.state_id IN (:...states)', {
          states: query.states.split(','),
        });
      }
      if (query.districts) {
        qb.andWhere('owner.district_id IN (:...districts)', {
          districts: query.districts.split(','),
        });
      }
    }

    if (query.search) {
      qb.andWhere(
        '(voucher.voucher_code ILIKE :kw OR offer.title ILIKE :kw OR business.name ILIKE :kw OR profile.full_name ILIKE :kw)',
        { kw: `%${query.search}%` }
      );
    }

    if (user?.role === UserRole.CUSTOMER) {
      qb.andWhere('voucher.customer_id = :userId', { userId: user.id });
    } else if (user?.role === UserRole.MEMBER) {
      qb.andWhere('business.owner_id = :userId', { userId: user.id });
    }

    qb.orderBy('voucher.created_at', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [vouchers, totalItems] = await qb.getManyAndCount();
    
    // Fetch customer avatars
    const customerIds = vouchers.map((v) => v.customer_id).filter((id) => id);
    const profilePics = customerIds.length > 0 ? await this.mediaRepository.find({
      where: {
        uploaded_by_id: In(customerIds),
        purpose: MediaPurpose.PROFILE_PIC,
      },
    }) : [];

    const profilePicMap = new Map<string, string>();
    profilePics.forEach((pic) => {
      if (pic.uploaded_by_id) {
        profilePicMap.set(pic.uploaded_by_id, pic.file_url);
      }
    });

    const data = vouchers.map((v) => {
      const { ...voucherData } = v;
      const customer_name = v.customer?.profile?.full_name || 'Unknown';
      const customer_phone = v.customer ? (v.customer as any).phone : null;
      const customer_avatar = profilePicMap.get(v.customer_id) || null;
      
      const businessName = v.business ? v.business.name : 'Unknown';
      const offerTitle = v.offer ? v.offer.title : 'Unknown';
      const offer_type = v.offer ? v.offer.offer_type : undefined;
      const discount_type = v.offer ? v.offer.discount_type : undefined;
      const discount_value = v.offer ? (v.offer.discount_value ? Number(v.offer.discount_value) : null) : null;
      
      const discountText = v.offer ? 
        (v.offer.offer_type === 'CASHBACK'
          ? `₹${discount_value} Cashback`
          : v.offer.discount_type === 'PERCENTAGE' 
            ? `${discount_value}% OFF` 
            : v.offer.discount_type === 'FIXED_AMOUNT' 
              ? `₹${discount_value} Flat OFF` 
              : 'Special Deal') 
        : 'Special Deal';
        
      delete (voucherData as any).customer;
      
      return {
        ...voucherData,
        customer_name,
        customer_phone,
        customer_avatar,
        businessName,
        offerTitle,
        discountText,
        offer_type,
        discount_type,
        discount_value,
      };
    });

    return {
      data,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: string, user?: User): Promise<Voucher> {
    const qb = this.voucherRepository.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.business', 'business');
    qb.leftJoinAndSelect('voucher.offer', 'offer');
    qb.leftJoinAndSelect('voucher.customer', 'customer');
    qb.leftJoinAndSelect('customer.profile', 'profile');

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (isUuid) {
      qb.where('voucher.id = :id', { id });
    } else {
      qb.where('voucher.voucher_code = :code', { code: id });
    }
    const voucher = await qb.getOne();

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const isAdmin = user?.role === UserRole.ADMIN;
    const isCustomer = user && voucher.customer_id === user.id;
    const isBusinessOwner = user && voucher.business?.owner_id === user.id;
    const isMember = user?.role === UserRole.MEMBER && user?.status === UserStatus.ACTIVE;

    if (!isAdmin && !isCustomer && !isBusinessOwner && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view this voucher',
      );
    }

    let wallet_balance = 0;
    if (voucher.customer_id) {
      const wallet = await this.walletRepository.findOne({ where: { user_id: voucher.customer_id } });
      if (wallet) {
        wallet_balance = Number(wallet.balance) || 0;
      }
    }

    const { ...voucherData } = voucher;
    
    const customer_name = voucher.customer?.profile?.full_name || 'Unknown';
    const customer_phone = voucher.customer ? voucher.customer.phone : 'Unknown';
    
    delete (voucherData as any).customer;
    delete (voucherData as any).redeemed_by;

    return {
      ...voucherData,
      customer_name,
      customer_phone,
      wallet_balance,
      offer_type: voucher.offer?.offer_type,
      discount_type: voucher.offer?.discount_type,
      discount_value: voucher.offer?.discount_value ? Number(voucher.offer.discount_value) : null,
      businessName: voucher.business?.name || 'Unknown',
      offerTitle: voucher.offer?.title || 'Unknown',
      discountText: voucher.offer ? 
        (voucher.offer.offer_type === 'CASHBACK'
          ? `₹${voucher.offer.discount_value} Cashback`
          : voucher.offer.discount_type === 'PERCENTAGE' 
            ? `${voucher.offer.discount_value}% OFF` 
            : voucher.offer.discount_type === 'FIXED_AMOUNT' 
              ? `₹${voucher.offer.discount_value} Flat OFF` 
              : 'Special Deal') 
        : 'Special Deal'
    } as any;
  }
}
