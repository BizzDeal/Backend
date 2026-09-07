import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeaturedRequestStatus } from '../../../common/enums';

export const createFeaturedRequestSchema = z
  .object({
    title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
    start_date: z.preprocess((val) => {
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date()),
    end_date: z.preprocess((val) => {
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date()),
    business_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // Past dates not allowed: start_date must not be in the past (allowing 5 min tolerance)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return data.start_date >= fiveMinutesAgo;
    },
    {
      message: 'Start date cannot be in the past',
      path: ['start_date'],
    },
  )
  .refine(
    (data) => data.end_date > data.start_date,
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

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Start date and time for featured status (past dates not allowed)',
    example: '2026-09-10T10:00:00.000Z',
  })
  start_date: Date | string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'End date and time for featured status (must be after start_date)',
    example: '2026-09-20T22:00:00.000Z',
  })
  end_date: Date | string;

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
  banner?: any;
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
