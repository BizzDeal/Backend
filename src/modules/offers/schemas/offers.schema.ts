import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferType, DiscountType, OfferStatus } from '../../../common/enums';

export const createOfferSchema = z
  .object({
    business_id: z
      .string()
      .uuid({ message: 'Valid business_id UUID is required' }),
    title: z
      .string()
      .min(3, { message: 'Title must be at least 3 characters long' }),
    description: z.string().min(1, { message: 'Description is required' }),
    offer_type: z.nativeEnum(OfferType),
    discount_value: z
      .preprocess((val) => {
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
      }, z.number().nonnegative().nullable())
      .optional(),
    discount_type: z.nativeEnum(DiscountType).nullable().optional(),
    start_date: z.preprocess((val) => {
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date()),
    end_date: z.preprocess((val) => {
      if (typeof val === 'string' || val instanceof Date) return new Date(val);
      return val;
    }, z.date()),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'end_date cannot be earlier than start_date',
    path: ['end_date'],
  });

export class CreateOfferDto {
  @ApiProperty({
    type: String,
    description: 'UUID of the business offering the deal',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  business_id: string;

  @ApiProperty({
    type: String,
    description: 'Title of the offer or deal',
    example: '20% Off Weekend Special',
  })
  title: string;

  @ApiProperty({
    type: String,
    description: 'Detailed description of the offer terms and conditions',
    example: 'Get 20% discount on all services during weekends.',
  })
  description: string;

  @ApiProperty({
    enum: OfferType,
    description: 'Type of offer',
    example: OfferType.DISCOUNT,
  })
  offer_type: OfferType;

  @ApiPropertyOptional({
    type: Number,
    description: 'Numeric value of discount or cashback',
    example: 20,
  })
  discount_value?: number | null;

  @ApiPropertyOptional({
    enum: DiscountType,
    description: 'Discount calculation mechanism',
    example: DiscountType.PERCENTAGE,
  })
  discount_type?: DiscountType | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Start date and time of the offer (ISO format)',
    example: '2026-07-01T00:00:00.000Z',
  })
  start_date: Date | string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'End date and time of the offer (ISO format)',
    example: '2026-07-31T23:59:59.999Z',
  })
  end_date: Date | string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Promotional banner image file',
  })
  offer_image?: any;
}

export const updateOfferSchema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    offer_type: z.nativeEnum(OfferType).optional(),
    discount_value: z
      .preprocess((val) => {
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? val : num;
      }, z.number().nonnegative().nullable())
      .optional(),
    discount_type: z.nativeEnum(DiscountType).nullable().optional(),
    start_date: z
      .preprocess((val) => {
        if (!val) return undefined;
        if (typeof val === 'string' || val instanceof Date)
          return new Date(val);
        return val;
      }, z.date())
      .optional(),
    end_date: z
      .preprocess((val) => {
        if (!val) return undefined;
        if (typeof val === 'string' || val instanceof Date)
          return new Date(val);
        return val;
      }, z.date())
      .optional(),
    status: z.nativeEnum(OfferStatus).optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
      }
      return true;
    },
    {
      message: 'end_date cannot be earlier than start_date',
      path: ['end_date'],
    },
  );

export class UpdateOfferDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Updated title of the offer',
    example: '25% Off Super Weekend Special',
  })
  title?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Updated description of the offer',
  })
  description?: string;

  @ApiPropertyOptional({
    enum: OfferType,
  })
  offer_type?: OfferType;

  @ApiPropertyOptional({
    type: Number,
    description: 'Numeric value of discount or cashback',
  })
  discount_value?: number | null;

  @ApiPropertyOptional({
    enum: DiscountType,
  })
  discount_type?: DiscountType | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Start date and time of the offer (ISO format)',
  })
  start_date?: Date | string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'End date and time of the offer (ISO format)',
  })
  end_date?: Date | string;

  @ApiPropertyOptional({
    enum: OfferStatus,
    description: 'Status of the offer (Admin only)',
  })
  status?: OfferStatus;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Replacement promotional image file',
  })
  offer_image?: any;
}

export const offerQuerySchema = z.object({
  business_id: z.string().uuid().optional(),
  category_id: z.string().optional(),
  offer_type: z.nativeEnum(OfferType).optional(),
  status: z.nativeEnum(OfferStatus).optional(),
  search: z.string().optional(),
  q: z.string().optional(),
  my_offers: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  states: z.string().optional(),
  districts: z.string().optional(),
});

export class OfferQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filter by specific business UUID',
  })
  business_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by category UUID or slug',
  })
  category_id?: string;

  @ApiPropertyOptional({
    enum: OfferType,
    description: 'Filter by offer type',
  })
  offer_type?: OfferType;

  @ApiPropertyOptional({
    enum: OfferStatus,
    description: 'Filter by offer status (Admin/Owner only)',
  })
  status?: OfferStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Search term matching title, description, or business name',
  })
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Alias search term matching title, description, or business name',
  })
  q?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'If true, returns only offers created by the logged-in member business owner',
  })
  my_offers?: boolean;

  @ApiPropertyOptional({
    description: 'Comma-separated state UUIDs for filtering',
  })
  states?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated district UUIDs for filtering',
  })
  districts?: string;
}

export const offerActionSchema = z.object({
  offer_id: z.string().uuid({ message: 'Valid offer_id UUID is required' }),
  reason: z.string().optional(),
});

export class OfferActionDto {
  @ApiProperty({
    type: String,
    description: 'UUID of the offer to approve or reject',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  offer_id: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Reason for rejection if applicable',
  })
  reason?: string;
}
