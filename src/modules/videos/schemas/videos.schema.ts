import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoType, VideoCategory, VideoStatus } from '../../../common/enums';
import { paginationQuerySchema, PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const createVideoSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters long' }),
  description: z.string().optional().nullable(),
  tags: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (Array.isArray(val)) {
        return val.map((s) => String(s).trim()).filter(Boolean);
      }
      return val || [];
    }, z.array(z.string()))
    .optional()
    .default([]),
  video_url: z.string().url({ message: 'Valid video URL is required' }),
  thumbnail_url: z.string().url().optional().nullable(),
  video_type: z.nativeEnum(VideoType).optional().default(VideoType.LANDSCAPE),
  category: z.nativeEnum(VideoCategory).optional().default(VideoCategory.GENERAL),
  business_id: z.string().uuid().optional().nullable(),
  offer_id: z.string().uuid().optional().nullable(),
  cta_title: z.string().max(100).optional().nullable(),
  cta_url: z.string().max(1000).optional().nullable(),
  status: z.nativeEnum(VideoStatus).optional().default(VideoStatus.ACTIVE),
});

export class CreateVideoDto {
  @ApiProperty({
    type: String,
    description: 'Title of the video',
    example: 'New Store Launch & Tour 2026',
  })
  title: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Detailed description of the video',
    example: 'Explore our latest collections and exclusive offers.',
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Tags for categorization and search',
    example: ['sale', 'storetour', 'fashion'],
  })
  tags?: string[];

  @ApiProperty({
    type: String,
    description: 'Video URL (YouTube, Instagram, TikTok, Vimeo, or direct MP4)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  video_url: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Custom thumbnail URL',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  })
  thumbnail_url?: string | null;

  @ApiPropertyOptional({
    enum: VideoType,
    description: 'Video aspect ratio / orientation',
    example: VideoType.SHORT_PORTRAIT,
  })
  video_type?: VideoType;

  @ApiPropertyOptional({
    enum: VideoCategory,
    description: 'Category or intent of the video',
    example: VideoCategory.BUSINESS_TOUR,
  })
  category?: VideoCategory;

  @ApiPropertyOptional({
    type: String,
    description: 'Linked business UUID (optional)',
  })
  business_id?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Linked offer UUID (optional)',
  })
  offer_id?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Call to action button title (optional)',
    example: 'Claim Deal',
  })
  cta_title?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Call to action destination URL (optional)',
    example: 'https://wa.me/919999999999',
  })
  cta_url?: string | null;

  @ApiPropertyOptional({
    enum: VideoStatus,
    description: 'Active status of the video',
    example: VideoStatus.ACTIVE,
  })
  status?: VideoStatus;
}

export const updateVideoSchema = createVideoSchema.partial();

export class UpdateVideoDto extends CreateVideoDto {}

export const videoQuerySchema = paginationQuerySchema.extend({
  video_type: z.nativeEnum(VideoType).optional(),
  category: z.nativeEnum(VideoCategory).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  business_id: z.string().uuid().optional(),
});

export class VideoQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: VideoType,
    description: 'Filter by video orientation',
  })
  video_type?: VideoType;

  @ApiPropertyOptional({
    enum: VideoCategory,
    description: 'Filter by video category',
  })
  category?: VideoCategory;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by tag (e.g. sale, storetour)',
  })
  tag?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Search across titles and descriptions',
  })
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by business UUID',
  })
  business_id?: string;
}
