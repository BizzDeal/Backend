import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import { MediaService } from '../media/media.service';
import { User } from '../users/entities/user.entity';
import {
  CreateOfferDto,
  UpdateOfferDto,
  OfferQueryDto,
} from './schemas/offers.schema';
import {
  UserRole,
  OfferStatus,
  BusinessStatus,
  MediaPurpose,
} from '../../common/enums';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    dto: CreateOfferDto,
    user: User,
    file?: Express.Multer.File,
  ): Promise<Offer> {
    const business = await this.businessRepository.findOne({
      where: { id: dto.business_id },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    if (!isAdmin && business.owner_id !== user.id) {
      throw new ForbiddenException('You can only create offers for your own business');
    }

    if (!isAdmin && business.status !== BusinessStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot create offers for an inactive or pending business profile',
      );
    }

    let imageId: string | null = null;
    if (file) {
      const media = await this.mediaService.saveFile(
        file,
        user.id,
        MediaPurpose.OFFER_IMAGE,
      );
      imageId = media.id;
    }

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);

    const offer = this.offerRepository.create({
      business_id: dto.business_id,
      title: dto.title,
      description: dto.description,
      offer_type: dto.offer_type,
      discount_value: dto.discount_value ?? null,
      discount_type: dto.discount_type ?? null,
      start_date: start,
      end_date: end,
      image_id: imageId,
      status: isAdmin ? OfferStatus.APPROVED : OfferStatus.PENDING,
      approved_by_id: isAdmin ? user.id : null,
      approved_at: isAdmin ? new Date() : null,
    });

    const savedOffer = await this.offerRepository.save(offer);
    delete (savedOffer as any).business;
    delete (savedOffer as any).image;
    delete (savedOffer as any).approved_by;
    return savedOffer;
  }

  async findAll(query: OfferQueryDto, user?: User): Promise<Offer[]> {
    const qb = this.offerRepository.createQueryBuilder('offer');
    qb.leftJoin('offer.business', 'business');

    if (query.business_id) {
      qb.andWhere('offer.business_id = :businessId', {
        businessId: query.business_id,
      });
    }

    if (query.offer_type) {
      qb.andWhere('offer.offer_type = :offerType', {
        offerType: query.offer_type,
      });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((qbInner) => {
          qbInner
            .where('offer.title ILIKE :search', { search: `%${query.search}%` })
            .orWhere('offer.description ILIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    const now = new Date();
    const isCustomerOrGuest = !user || user.role === UserRole.CUSTOMER;

    if (isCustomerOrGuest) {
      qb.andWhere('offer.status = :approvedStatus', {
        approvedStatus: OfferStatus.APPROVED,
      });
      qb.andWhere('offer.start_date <= :now', { now });
      qb.andWhere('offer.end_date >= :now', { now });
    } else if (user?.role === UserRole.MEMBER) {
      if (query.status) {
        qb.andWhere('offer.status = :status', { status: query.status });
      }
      qb.andWhere(
        new Brackets((qbInner) => {
          qbInner
            .where('business.owner_id = :userId', { userId: user.id })
            .orWhere(
              '(offer.status = :approvedStatus AND offer.start_date <= :now AND offer.end_date >= :now)',
              { approvedStatus: OfferStatus.APPROVED, now },
            );
        }),
      );
    } else if (user?.role === UserRole.ADMIN) {
      if (query.status) {
        qb.andWhere('offer.status = :status', { status: query.status });
      }
    }

    qb.orderBy('offer.created_at', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user?: User): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: { business: true, image: true, approved_by: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const isOwner = user && offer.business?.owner_id === user.id;
    const isAdmin = user?.role === UserRole.ADMIN;

    if (offer.status !== OfferStatus.APPROVED && !isOwner && !isAdmin) {
      throw new ForbiddenException('Offer is not available or pending approval');
    }

    delete (offer as any).business;
    delete (offer as any).image;
    delete (offer as any).approved_by;

    return offer;
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    user: User,
    file?: Express.Multer.File,
  ): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: { business: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const isOwner = offer.business?.owner_id === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only update your own business offers');
    }

    if (!isAdmin && dto.status) {
      throw new ForbiddenException('Only admins can change offer status directly');
    }

    if (file) {
      if (offer.image_id) {
        await this.mediaService.deleteFileById(offer.image_id);
      }
      const media = await this.mediaService.saveFile(
        file,
        user.id,
        MediaPurpose.OFFER_IMAGE,
      );
      offer.image_id = media.id;
    }

    if (dto.title !== undefined) offer.title = dto.title;
    if (dto.description !== undefined) offer.description = dto.description;
    if (dto.offer_type !== undefined) offer.offer_type = dto.offer_type;
    if (dto.discount_value !== undefined) offer.discount_value = dto.discount_value;
    if (dto.discount_type !== undefined) offer.discount_type = dto.discount_type;
    if (dto.start_date !== undefined) offer.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined) offer.end_date = new Date(dto.end_date);

    if (isAdmin && dto.status) {
      offer.status = dto.status;
      if (dto.status === OfferStatus.APPROVED) {
        offer.approved_by_id = user.id;
        offer.approved_at = new Date();
      }
    } else if (!isAdmin) {
      this.logger.log(
        `Offer ${offer.id} modified by member ${user.id}. Setting status to PENDING for re-approval.`,
      );
      offer.status = OfferStatus.PENDING;
      offer.approved_by_id = null;
      offer.approved_at = null;
    }

    const savedOffer = await this.offerRepository.save(offer);
    delete (savedOffer as any).business;
    delete (savedOffer as any).image;
    delete (savedOffer as any).approved_by;
    return savedOffer;
  }

  async delete(id: string, user: User): Promise<{ success: boolean }> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: { business: true },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const isOwner = offer.business?.owner_id === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only delete your own business offers');
    }

    if (offer.image_id) {
      await this.mediaService.deleteFileById(offer.image_id);
    }

    await this.offerRepository.remove(offer);
    return { success: true };
  }

  async approve(offerId: string, adminId: string): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    offer.status = OfferStatus.APPROVED;
    offer.approved_by_id = adminId;
    offer.approved_at = new Date();

    const savedOffer = await this.offerRepository.save(offer);
    delete (savedOffer as any).business;
    delete (savedOffer as any).image;
    delete (savedOffer as any).approved_by;
    return savedOffer;
  }

  async reject(offerId: string, adminId: string, reason?: string): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    offer.status = OfferStatus.REJECTED;
    if (reason) {
      this.logger.log(`Offer ${offerId} rejected by admin ${adminId}. Reason: ${reason}`);
    }

    const savedOffer = await this.offerRepository.save(offer);
    delete (savedOffer as any).business;
    delete (savedOffer as any).image;
    delete (savedOffer as any).approved_by;
    return savedOffer;
  }
}
