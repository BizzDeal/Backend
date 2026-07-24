import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, ReferralStatus } from '../../common/enums';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findAll(user: User, filter?: any): Promise<Referral[]> {
    const qb = this.referralRepository.createQueryBuilder('referral');
    
    if (user.role !== UserRole.ADMIN) {
      qb.andWhere('referral.referrer_id = :userId', { userId: user.id });
    }

    if (filter?.states || filter?.districts) {
      qb.leftJoin('referral.referrer', 'referrer');
      if (filter.states) {
        qb.andWhere('referrer.state_id IN (:...states)', {
          states: filter.states.split(','),
        });
      }
      if (filter.districts) {
        qb.andWhere('referrer.district_id IN (:...districts)', {
          districts: filter.districts.split(','),
        });
      }
    }

    qb.orderBy('referral.created_at', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Referral> {
    const referral = await this.referralRepository.findOne({ where: { id } });
    if (!referral) {
      throw new NotFoundException('Referral not found');
    }
    if (user.role !== UserRole.ADMIN && referral.referrer_id !== user.id) {
      throw new ForbiddenException('No permission to view this referral');
    }
    return referral;
  }

  async create(
    data: {
      referred_phone: string;
      referral_code: string;
      reward_amount?: number;
    },
    user: User,
  ): Promise<Referral> {
    const referral = this.referralRepository.create({
      referrer_id: user.id,
      referred_phone: data.referred_phone,
      referral_code: data.referral_code,
      reward_amount: data.reward_amount || 0,
      status: ReferralStatus.PENDING,
    });
    const saved = await this.referralRepository.save(referral);
    if (saved) {
      await this.analyticsService.trackReferralCreated();
    }
    return saved;
  }

  async checkContacts(phones: string[]): Promise<string[]> {
    if (!phones || phones.length === 0) {
      return [];
    }

    // 1. Find all phones that already have a user account
    const existingUsers = await this.userRepository.find({
      where: { phone: In(phones) },
      select: { phone: true },
    });
    const existingUserPhones = new Set(existingUsers.map((u) => u.phone));

    // 2. Find all phones that have active referrals (status = PENDING or JOINED or REWARDED)
    const existingReferrals = await this.referralRepository.find({
      where: {
        referred_phone: In(phones),
        status: In([
          ReferralStatus.PENDING,
          ReferralStatus.JOINED,
          ReferralStatus.REWARDED,
        ]),
      },
      select: { referred_phone: true },
    });
    const referredPhones = new Set(
      existingReferrals.map((r) => r.referred_phone),
    );

    // 3. Filter input list to only return phones that are neither registered nor referred
    return phones.filter(
      (phone) => !existingUserPhones.has(phone) && !referredPhones.has(phone),
    );
  }

  async bulkCreate(
    data: { referred_phones: string[]; referral_code: string },
    user: User,
  ): Promise<Referral[]> {
    if (!data.referred_phones || data.referred_phones.length === 0) {
      return [];
    }

    return this.referralRepository.manager.transaction(async (manager) => {
      const savedReferrals: Referral[] = [];

      for (const phone of data.referred_phones) {
        const referral = manager.create(Referral, {
          referrer_id: user.id,
          referred_phone: phone,
          referral_code: data.referral_code,
          reward_amount: 0,
          status: ReferralStatus.PENDING,
        });
        const saved = await manager.save(Referral, referral);
        if (saved) {
          savedReferrals.push(saved);
          await this.analyticsService.trackReferralCreated();
        }
      }

      return savedReferrals;
    });
  }

  async validateReferralCode(
    referralCode: string,
    phone: string,
  ): Promise<void> {
    const cleanInputPhone = phone.replace(/\D/g, '');

    const referrals = await this.referralRepository.find({
      where: {
        referral_code: referralCode,
        status: ReferralStatus.PENDING,
      },
    });

    const matchingReferral = referrals.find((ref) => {
      const cleanRefPhone = ref.referred_phone.replace(/\D/g, '');
      return cleanRefPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(cleanRefPhone);
    });

    if (!matchingReferral) {
      throw new BadRequestException('Invalid reference code or phone number not referred');
    }
  }

  async updateReferralOnRegistration(
    referralCode: string,
    phone: string,
    referredUserId: string,
  ): Promise<void> {
    const cleanInputPhone = phone.replace(/\D/g, '');

    const referrals = await this.referralRepository.find({
      where: {
        referral_code: referralCode,
        status: ReferralStatus.PENDING,
      },
    });

    const matchingReferral = referrals.find((ref) => {
      const cleanRefPhone = ref.referred_phone.replace(/\D/g, '');
      return cleanRefPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(cleanRefPhone);
    });

    if (matchingReferral) {
      matchingReferral.referred_user_id = referredUserId;
      matchingReferral.status = ReferralStatus.JOINED;
      await this.referralRepository.save(matchingReferral);
    }
  }

  async revertReferralRegistration(referredUserId: string): Promise<void> {
    const referral = await this.referralRepository.findOne({
      where: { referred_user_id: referredUserId },
    });
    if (referral) {
      referral.referred_user_id = null;
      referral.status = ReferralStatus.PENDING;
      await this.referralRepository.save(referral);
    }
  }
}
