import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, ReferralStatus } from '../../common/enums';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
  ) {}

  async findAll(user: User): Promise<Referral[]> {
    if (user.role === UserRole.ADMIN) {
      return this.referralRepository.find({ order: { created_at: 'DESC' } });
    }
    return this.referralRepository.find({
      where: { referrer_id: user.id },
      order: { created_at: 'DESC' },
    });
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

  async create(data: { referred_phone: string; referral_code: string; reward_amount?: number }, user: User): Promise<Referral> {
    const referral = this.referralRepository.create({
      referrer_id: user.id,
      referred_phone: data.referred_phone,
      referral_code: data.referral_code,
      reward_amount: data.reward_amount || 0,
      status: ReferralStatus.PENDING,
    });
    return this.referralRepository.save(referral);
  }
}
