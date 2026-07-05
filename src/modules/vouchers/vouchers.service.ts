import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Voucher } from './entities/voucher.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import {
  IssueVoucherDto,
  RedeemVoucherDto,
  VoucherQueryDto,
} from './schemas/vouchers.schema';
import {
  VoucherStatus,
  OfferStatus,
  BusinessStatus,
  UserRole,
  OfferType,
  DiscountType,
  WalletTransactionType,
  WalletReferenceType,
} from '../../common/enums';

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepository: Repository<Voucher>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
      if (dto.customer_id && dto.customer_id !== user.id) {
        throw new ForbiddenException(
          'Customers can only claim vouchers for themselves',
        );
      }
      targetCustomerId = user.id;
    } else {
      if (!dto.customer_id) {
        throw new BadRequestException(
          'customer_id is required when issuing a voucher as a Member or Admin',
        );
      }
      const targetCustomer = await this.userRepository.findOne({
        where: { id: dto.customer_id },
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
      expires_at: offer.end_date,
    });

    return this.voucherRepository.save(voucher);
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
    if (voucher.status === VoucherStatus.EXPIRED || now > voucher.expires_at) {
      if (voucher.status !== VoucherStatus.EXPIRED) {
        voucher.status = VoucherStatus.EXPIRED;
        await this.voucherRepository.save(voucher);
      }
      throw new BadRequestException('Voucher has expired');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    const isBusinessOwner = voucher.business?.owner_id === user.id;

    if (!isAdmin && !isBusinessOwner) {
      throw new ForbiddenException(
        'Only the business owner or an admin can redeem this voucher',
      );
    }

    return this.voucherRepository.manager.transaction(async (manager) => {
      voucher.status = VoucherStatus.REDEEMED;
      voucher.redeemed_at = now;
      voucher.redeemed_by_id = user.id;
      const savedVoucher = await manager.save(Voucher, voucher);

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

      if (calculatedAmount > 0 || remainingAmount > 0) {
        let wallet = await manager.findOne(Wallet, {
          where: { user_id: voucher.customer_id },
        });

        if (!wallet) {
          wallet = manager.create(Wallet, {
            user_id: voucher.customer_id,
            balance: 0,
            total_savings: 0,
          });
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

        await manager.save(Wallet, wallet);
      }

      return savedVoucher;
    });
  }

  async findAll(query: VoucherQueryDto, user?: User): Promise<Voucher[]> {
    const qb = this.voucherRepository.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.offer', 'offer');
    qb.leftJoinAndSelect('voucher.business', 'business');
    qb.leftJoinAndSelect('voucher.customer', 'customer');
    qb.leftJoinAndSelect('voucher.redeemed_by', 'redeemed_by');

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

    if (user?.role === UserRole.CUSTOMER) {
      qb.andWhere('voucher.customer_id = :userId', { userId: user.id });
    } else if (user?.role === UserRole.MEMBER) {
      qb.andWhere('business.owner_id = :userId', { userId: user.id });
    }

    qb.orderBy('voucher.created_at', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user?: User): Promise<Voucher> {
    const qb = this.voucherRepository.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.offer', 'offer');
    qb.leftJoinAndSelect('voucher.business', 'business');
    qb.leftJoinAndSelect('voucher.customer', 'customer');
    qb.leftJoinAndSelect('voucher.redeemed_by', 'redeemed_by');

    qb.where('voucher.id = :id OR voucher.voucher_code = :id', { id });
    const voucher = await qb.getOne();

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    const isAdmin = user?.role === UserRole.ADMIN;
    const isCustomer = user && voucher.customer_id === user.id;
    const isBusinessOwner = user && voucher.business?.owner_id === user.id;

    if (!isAdmin && !isCustomer && !isBusinessOwner) {
      throw new ForbiddenException(
        'You do not have permission to view this voucher',
      );
    }

    return voucher;
  }
}
