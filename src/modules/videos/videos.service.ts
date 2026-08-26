import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from './entities/video.entity';
import { VideoLike } from './entities/video-like.entity';
import { VideoStatus, VideoType } from '../../common/enums';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './schemas/videos.schema';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(VideoLike)
    private readonly videoLikeRepo: Repository<VideoLike>,
  ) {}

  private extractYouTubeThumbnail(url: string): string | null {
    if (!url) return null;
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(ytRegExp);
    if (match && match[2].length === 11) {
      return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
    }
    return null;
  }

  private isLikelyShort(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('shorts/') || lower.includes('instagram.com/reel/') || lower.includes('tiktok.com');
  }

  async getPublicVideos(query: VideoQueryDto, userId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.business', 'b')
      .leftJoinAndSelect('v.offer', 'o')
      .where('v.status = :status', { status: VideoStatus.ACTIVE });

    if (query.video_type) {
      qb.andWhere('v.video_type = :vType', { vType: query.video_type });
    }

    if (query.category) {
      qb.andWhere('v.category = :category', { category: query.category });
    }

    if (query.business_id) {
      qb.andWhere('v.business_id = :bizId', { bizId: query.business_id });
    }

    if (query.tag) {
      qb.andWhere(':tag = ANY(v.tags)', { tag: query.tag.trim().toLowerCase() });
    }

    if (query.search) {
      const s = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(v.title) LIKE :s OR LOWER(v.description) LIKE :s)', { s });
    }

    qb.orderBy('v.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    let likedVideoIds = new Set<string>();
    if (userId && items.length > 0) {
      const itemIds = items.map((v) => v.id);
      const userLikes = await this.videoLikeRepo
        .createQueryBuilder('vl')
        .where('vl.user_id = :userId AND vl.video_id IN (:...itemIds)', { userId, itemIds })
        .getMany();
      likedVideoIds = new Set(userLikes.map((l) => l.video_id));
    }

    const enhancedItems = items.map((item) => ({
      ...item,
      is_liked: likedVideoIds.has(item.id),
    }));

    return {
      items: enhancedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyVideos(userId: string) {
    return this.videoRepo.find({
      where: { user_id: userId },
      relations: { business: true, offer: true },
      order: { created_at: 'DESC' },
    });
  }

  async getVideoById(id: string, userId?: string) {
    const video = await this.videoRepo.findOne({
      where: { id },
      relations: { business: true, offer: true },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    let isLiked = false;
    if (userId) {
      const like = await this.videoLikeRepo.findOne({
        where: { video_id: id, user_id: userId },
      });
      isLiked = !!like;
    }

    return {
      ...video,
      is_liked: isLiked,
    };
  }

  async createVideo(userId: string, dto: CreateVideoDto) {
    let thumbnail = dto.thumbnail_url;
    if (!thumbnail) {
      thumbnail = this.extractYouTubeThumbnail(dto.video_url);
    }

    let videoType = dto.video_type;
    if (!videoType) {
      videoType = this.isLikelyShort(dto.video_url) ? VideoType.SHORT_PORTRAIT : VideoType.LANDSCAPE;
    }

    const processedTags = (dto.tags || []).map((t) =>
      t.trim().replace(/^#+/, '').toLowerCase()
    ).filter(Boolean);

    const newVideo = this.videoRepo.create({
      user_id: userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      tags: processedTags,
      video_url: dto.video_url.trim(),
      thumbnail_url: thumbnail,
      video_type: videoType,
      category: dto.category,
      business_id: dto.business_id || null,
      offer_id: dto.offer_id || null,
      cta_title: dto.cta_title?.trim() || null,
      cta_url: dto.cta_url?.trim() || null,
      status: dto.status || VideoStatus.ACTIVE,
    });

    return this.videoRepo.save(newVideo);
  }

  async updateVideo(id: string, userId: string, dto: UpdateVideoDto, isAdmin: boolean = false) {
    const video = await this.getVideoById(id);

    if (!isAdmin && video.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to modify this video');
    }

    if (dto.title !== undefined) video.title = dto.title.trim();
    if (dto.description !== undefined) video.description = dto.description?.trim() || null;
    if (dto.video_url !== undefined) {
      video.video_url = dto.video_url.trim();
      if (!dto.thumbnail_url) {
        video.thumbnail_url = this.extractYouTubeThumbnail(dto.video_url) || video.thumbnail_url;
      }
    }
    if (dto.thumbnail_url !== undefined) video.thumbnail_url = dto.thumbnail_url;
    if (dto.video_type !== undefined) video.video_type = dto.video_type;
    if (dto.category !== undefined) video.category = dto.category;
    if (dto.business_id !== undefined) video.business_id = dto.business_id || null;
    if (dto.offer_id !== undefined) video.offer_id = dto.offer_id || null;
    if (dto.cta_title !== undefined) video.cta_title = dto.cta_title?.trim() || null;
    if (dto.cta_url !== undefined) video.cta_url = dto.cta_url?.trim() || null;
    if (dto.status !== undefined) video.status = dto.status;
    if (dto.tags !== undefined) {
      video.tags = (dto.tags || []).map((t) =>
        t.trim().replace(/^#+/, '').toLowerCase()
      ).filter(Boolean);
    }

    return this.videoRepo.save(video);
  }

  async deleteVideo(id: string, userId: string, isAdmin: boolean = false) {
    const video = await this.getVideoById(id);

    if (!isAdmin && video.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to delete this video');
    }

    await this.videoRepo.remove(video);
    return { success: true, message: 'Video deleted successfully' };
  }

  async incrementViews(id: string) {
    await this.videoRepo.increment({ id }, 'views_count', 1);
    return { success: true };
  }

  async toggleLike(id: string, userId: string) {
    const video = await this.videoRepo.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    const existingLike = await this.videoLikeRepo.findOne({
      where: { video_id: id, user_id: userId },
    });

    let isLiked = false;
    let updatedLikesCount = video.likes_count || 0;

    if (existingLike) {
      // User already liked -> UNLIKE (dislike)
      await this.videoLikeRepo.remove(existingLike);
      updatedLikesCount = Math.max(0, updatedLikesCount - 1);
      await this.videoRepo.update(id, { likes_count: updatedLikesCount });
      isLiked = false;
    } else {
      // User hasn't liked -> LIKE
      const newLike = this.videoLikeRepo.create({
        video_id: id,
        user_id: userId,
      });
      await this.videoLikeRepo.save(newLike);
      updatedLikesCount = updatedLikesCount + 1;
      await this.videoRepo.update(id, { likes_count: updatedLikesCount });
      isLiked = true;
    }

    return {
      success: true,
      is_liked: isLiked,
      likes_count: updatedLikesCount,
    };
  }
}
