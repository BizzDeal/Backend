import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { CreateReferralSlipDto, ReferralQueryDto, AdminReferralQueryDto, AppreciateReferralDto, AdminDailyStatsQueryDto } from './schemas/referrals.schema';
import { ReferralType } from '../../common/enums';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private referralRepo: Repository<Referral>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private chatService: ChatService,
  ) {}

  async createReferralSlip(referrerId: string, dto: CreateReferralSlipDto) {
    const toMember = await this.userRepo.findOne({ where: { id: dto.to_member_id } });
    if (!toMember) {
      throw new NotFoundException('The receiving member does not exist.');
    }
    
    if (referrerId === dto.to_member_id) {
      throw new BadRequestException('You cannot send a referral to yourself.');
    }

    const referral = this.referralRepo.create({
      referrer_id: referrerId,
      to_member_id: dto.to_member_id,
      referral_type: dto.referral_type,
      told_to_call: dto.told_to_call,
      card_given: dto.card_given,
      contact_name: dto.contact_name,
      contact_phone: dto.contact_phone,
      contact_email: dto.contact_email || null,
      contact_address: dto.contact_address || null,
      comments: dto.comments || null,
      rating: dto.rating || null,
    });

    await this.referralRepo.save(referral);

    return {
      success: true,
      message: 'Referral slip created successfully.',
      data: referral,
    };
  }

  async getReferralSlips(userId: string, query: ReferralQueryDto) {
    const { type, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const qb = this.referralRepo.createQueryBuilder('referral')
      .leftJoin('referral.referrer', 'referrer')
      .leftJoin('referrer.profile', 'referrer_profile')
      .leftJoin('referrer.business_profile', 'referrer_business')
      .leftJoin('referral.to_member', 'to_member')
      .leftJoin('to_member.profile', 'to_member_profile')
      .leftJoin('to_member.business_profile', 'to_member_business')
      .select([
        'referral',
        'referral.is_appreciated',
        'referral.cost_of_business',
        'referral.appreciation_message',
        'referral.rating',
        'referrer.id',
        'referrer.phone',
        'referrer.email',
        'referrer_profile.full_name',
        'referrer_business.name',
        'to_member.id',
        'to_member.phone',
        'to_member.email',
        'to_member_profile.full_name',
        'to_member_business.name',
      ])
      .orderBy('referral.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (type === 'GIVEN') {
      qb.where('referral.referrer_id = :userId', { userId });
    } else if (type === 'RECEIVED') {
      qb.where('referral.to_member_id = :userId', { userId });
    } else {
      qb.where('referral.referrer_id = :userId OR referral.to_member_id = :userId', { userId });
    }

    const [items, total] = await qb.getManyAndCount();

    const formattedItems = items.map((ref) => ({
      ...ref,
      referrer: ref.referrer ? {
        id: ref.referrer.id,
        phone: ref.referrer.phone,
        email: ref.referrer.email,
        full_name: (ref.referrer as any).profile?.full_name || 'Member',
        businessProfile: (ref.referrer as any).business_profile ? {
          business_name: (ref.referrer as any).business_profile.name,
        } : null,
      } : null,
      to_member: ref.to_member ? {
        id: ref.to_member.id,
        phone: ref.to_member.phone,
        email: ref.to_member.email,
        full_name: (ref.to_member as any).profile?.full_name || 'Member',
        businessProfile: (ref.to_member as any).business_profile ? {
          business_name: (ref.to_member as any).business_profile.name,
        } : null,
      } : null,
    }));

    return {
      success: true,
      data: formattedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminReferralSlips(query: AdminReferralQueryDto) {
    const { search, referral_type, start_date, end_date, dates, state_id, district_id, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const qb = this.referralRepo.createQueryBuilder('referral')
      .leftJoin('referral.referrer', 'referrer')
      .leftJoin('referrer.profile', 'referrer_profile')
      .leftJoin('referrer.business_profile', 'referrer_business')
      .leftJoin('referral.to_member', 'to_member')
      .leftJoin('to_member.profile', 'to_member_profile')
      .leftJoin('to_member.business_profile', 'to_member_business')
      .select([
        'referral',
        'referral.is_appreciated',
        'referral.cost_of_business',
        'referral.appreciation_message',
        'referral.rating',
        'referrer.id',
        'referrer.phone',
        'referrer.email',
        'referrer_profile.full_name',
        'referrer_business.name',
        'to_member.id',
        'to_member.phone',
        'to_member.email',
        'to_member_profile.full_name',
        'to_member_business.name',
      ])
      .orderBy('referral.created_at', 'DESC');

    if (referral_type) {
      qb.andWhere('referral.referral_type = :referral_type', { referral_type });
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(referral.contact_name) LIKE :searchTerm OR LOWER(referral.contact_phone) LIKE :searchTerm OR LOWER(referrer_profile.full_name) LIKE :searchTerm OR LOWER(to_member_profile.full_name) LIKE :searchTerm)',
        { searchTerm },
      );
    }

    if (start_date) {
      const startDateObj = new Date(start_date);
      startDateObj.setHours(0, 0, 0, 0);
      qb.andWhere('referral.created_at >= :start_date', { start_date: startDateObj });
    }

    if (end_date) {
      const endDateObj = new Date(end_date);
      endDateObj.setHours(23, 59, 59, 999);
      qb.andWhere('referral.created_at <= :end_date', { end_date: endDateObj });
    }

    if (dates) {
      const dateList = dates.split(',').map(d => d.trim()).filter(d => d);
      if (dateList.length > 0) {
        qb.andWhere('DATE(referral.created_at) IN (:...dateList)', { dateList });
      }
    }

    if (state_id) {
      qb.andWhere('(referrer_profile.state_id = :state_id OR to_member_profile.state_id = :state_id)', { state_id });
    }

    if (district_id) {
      qb.andWhere('(referrer_profile.district_id = :district_id OR to_member_profile.district_id = :district_id)', { district_id });
    }

    const totalCount = await this.referralRepo.count();
    const inhouseCount = await this.referralRepo.count({ where: { referral_type: ReferralType.INHOUSE } });
    const outhouseCount = await this.referralRepo.count({ where: { referral_type: ReferralType.OUTHOUSE } });
    const totalAppreciations = await this.referralRepo.count({ where: { is_appreciated: true } });
    
    const revenueResult = await this.referralRepo.createQueryBuilder('referral')
      .select('SUM(referral.cost_of_business)', 'totalRevenue')
      .where('referral.is_appreciated = :isAppreciated', { isAppreciated: true })
      .getRawOne();
    const totalAppreciationRevenue = parseFloat(revenueResult?.totalRevenue || '0');

    // Get Highest Business Deal
    const highestBusinessRecord = await this.referralRepo.createQueryBuilder('referral')
      .leftJoinAndSelect('referral.referrer', 'referrer')
      .leftJoinAndSelect('referrer.profile', 'referrer_profile')
      .leftJoinAndSelect('referral.to_member', 'to_member')
      .leftJoinAndSelect('to_member.profile', 'to_member_profile')
      .where('referral.is_appreciated = :isAppreciated', { isAppreciated: true })
      .orderBy('CAST(referral.cost_of_business AS DECIMAL)', 'DESC')
      .addOrderBy('referral.created_at', 'DESC')
      .getOne();

    let highestBusiness: any = null;
    if (highestBusinessRecord) {
      highestBusiness = {
        contact_name: highestBusinessRecord.contact_name,
        revenue: highestBusinessRecord.cost_of_business,
        referrer_name: (highestBusinessRecord.referrer as any)?.profile?.full_name || 'Member',
        to_member_name: (highestBusinessRecord.to_member as any)?.profile?.full_name || 'Member',
        date: highestBusinessRecord.created_at,
      };
    }

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const formattedItems = items.map((ref) => ({
      ...ref,
      referrer: ref.referrer ? {
        id: ref.referrer.id,
        phone: ref.referrer.phone,
        email: ref.referrer.email,
        full_name: (ref.referrer as any).profile?.full_name || 'Member',
        businessProfile: (ref.referrer as any).business_profile ? {
          business_name: (ref.referrer as any).business_profile.name,
        } : null,
      } : null,
      to_member: ref.to_member ? {
        id: ref.to_member.id,
        phone: ref.to_member.phone,
        email: ref.to_member.email,
        full_name: (ref.to_member as any).profile?.full_name || 'Member',
        businessProfile: (ref.to_member as any).business_profile ? {
          business_name: (ref.to_member as any).business_profile.name,
        } : null,
      } : null,
    }));

    return {
      success: true,
      data: formattedItems,
      summary: {
        totalCount,
        inhouseCount,
        outhouseCount,
        totalAppreciations,
        totalAppreciationRevenue,
        highestBusiness,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async appreciateReferral(userId: string, referralId: string, dto: AppreciateReferralDto) {
    const referral = await this.referralRepo.findOne({ 
      where: { id: referralId },
      relations: { referrer: { profile: true } } 
    });
    if (!referral) {
      throw new NotFoundException('Referral not found.');
    }

    if (referral.to_member_id !== userId) {
      throw new BadRequestException('You can only appreciate referrals you received.');
    }

    if (referral.is_appreciated) {
      throw new BadRequestException('This referral has already been appreciated.');
    }

    referral.is_appreciated = true;
    referral.appreciation_message = dto.appreciation_message || null;
    referral.cost_of_business = dto.cost_of_business;

    await this.referralRepo.save(referral);

    // Send automated community chat message
    try {
      const currentUser = await this.userRepo.findOne({ where: { id: userId }, relations: { profile: true } });
      if (currentUser && referral.referrer) {
        const referrerName = referral.referrer.profile?.full_name || 'Member';
        const costStr = Number(dto.cost_of_business).toLocaleString('en-IN');
        
        let chatMessage = `🎉 *Appreciation Alert!* 🎉\n`;
        chatMessage += `I would like to thank **${referrerName}** for referring **${referral.contact_name}** to me!\n`;
        chatMessage += `We successfully closed business worth ₹**${costStr}**.`;

        await this.chatService.sendCommunityMessage(chatMessage, currentUser);
      }
    } catch (e) {
      console.error('Failed to send community appreciation message:', e);
    }

    return {
      success: true,
      message: 'Referral appreciated successfully.',
      data: referral,
    };
  }

  async getAdminDailyStats(query: AdminDailyStatsQueryDto) {
    const { month, year } = query;
    // month is 1-12
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const qb = this.referralRepo.createQueryBuilder('referral')
      .select('DATE(referral.created_at)', 'date')
      .addSelect('COUNT(referral.id)', 'count')
      .where('referral.created_at >= :startDate', { startDate })
      .andWhere('referral.created_at <= :endDate', { endDate })
      .groupBy('DATE(referral.created_at)');
    
    const results = await qb.getRawMany();

    const formattedData = results.map(row => {
      let dateString = row.date;
      // SQLite/MySQL DATE() returns YYYY-MM-DD
      // Depending on the DB driver, it could be a Date object or string.
      if (row.date instanceof Date) {
        dateString = row.date.toISOString().split('T')[0];
      } else if (typeof row.date === 'string') {
        dateString = row.date.split('T')[0];
      }
      return {
        date: dateString,
        count: Number(row.count)
      };
    });

    return {
      success: true,
      data: formattedData
    };
  }
}

