import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeaturedRequestStatus } from '../../../common/enums';

export const createFeaturedRequestSchema = z
  .object({
    title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
    start_date: z.preprocess((val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date().optional()),
    end_date: z.preprocess((val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date().optional()),
    business_id: z.preprocess(
      (val) => val === '' || val === null ? undefined : val,
      z.string().uuid().optional(),
    ),
  })
  .refine(
    (data) => !data.start_date || !data.end_date || data.end_date > data.start_date,
    {
      message: 'End date must be strictly after start date',
      path: ['end_date'],
    },
  );

export class CreateFeaturedRequestDto {
  @ApiProperty({
    type: String,
    description: 'Title of the featured business showcase',
    example: 'Special Festive Showcase - Grand Opening',
  })
  title: string;

  @ApiProperty({
    type: String,
    description: 'Detailed description of the featured business showcase',
    example: 'Explore our latest collection and special member deals at our flagship store.',
  })
  description: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Required for new or pending requests. Omit when editing an approved request; its dates are preserved.',
    example: '2026-09-10T10:00:00.000Z',
  })
  start_date?: Date | string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Required for new or pending requests, and must be after start_date. Omit when editing an approved request; its dates are preserved.',
    example: '2026-09-20T22:00:00.000Z',
  })
  end_date?: Date | string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the business profile (inferred for members)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  business_id?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Promotional banner image file for featured showcase',
  })
  banner?: Express.Multer.File;
}

export const rejectFeaturedRequestSchema = z.object({
  reason: z.string().min(3, { message: 'Rejection reason must be at least 3 characters' }),
});

export class RejectFeaturedRequestDto {
  @ApiProperty({
    type: String,
    description: 'Reason for rejecting the featured business request',
    example: 'Banner quality is too low or promotional details are incomplete.',
  })
  reason: string;
}

export const queryFeaturedRequestSchema = z.object({
  status: z.nativeEnum(FeaturedRequestStatus).or(z.literal('ALL')).optional(),
  category_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
});

export class QueryFeaturedRequestDto {
  @ApiPropertyOptional({
    enum: FeaturedRequestStatus,
    description: 'Filter requests by status',
  })
  status?: FeaturedRequestStatus | 'ALL';

  @ApiPropertyOptional({
    type: String,
    description: 'Filter requests by category ID',
  })
  category_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter requests by business ID',
  })
  business_id?: string;
}

export const adminUpdateFeaturedRequestSchema = z
  .object({
    title: z.string().min(3, { message: 'Title must be at least 3 characters' }).optional(),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }).optional(),
    start_date: z.preprocess((val) => {
      if (!val) return undefined;
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date().optional()),
    end_date: z.preprocess((val) => {
      if (!val) return undefined;
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date().optional()),
    status: z.nativeEnum(FeaturedRequestStatus).optional(),
    rejection_reason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date > data.start_date;
      }
      return true;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['end_date'],
    },
  );

export class AdminUpdateFeaturedRequestDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Updated title of the featured business showcase',
    example: 'Special Festive Showcase - Extended',
  })
  title?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Updated description of the featured showcase',
  })
  description?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Updated start date and time',
    example: '2026-09-10T10:00:00.000Z',
  })
  start_date?: Date | string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Updated end date and time',
    example: '2026-09-25T22:00:00.000Z',
  })
  end_date?: Date | string;

  @ApiPropertyOptional({
    enum: FeaturedRequestStatus,
    description: 'Updated request status',
    example: FeaturedRequestStatus.APPROVED,
  })
  status?: FeaturedRequestStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Reason if status is rejected or cancelled',
  })
  rejection_reason?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'New promotional banner image file',
  })
  banner?: Express.Multer.File;
}

export class UploadBannerDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Promotional banner image file for featured showcase (16:9)',
  })
  banner: Express.Multer.File;
}
