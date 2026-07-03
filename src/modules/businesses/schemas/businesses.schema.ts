import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessStatus } from '../../../common/enums';

export const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  category_id: z.string().uuid().optional(),
  description: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  status: z.nativeEnum(BusinessStatus).optional(),
  is_featured: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
});

export class UpdateBusinessDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Name of the business',
    example: 'Acme Enterprises Updated',
  })
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'UUID of the business category',
  })
  category_id?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Description of the business',
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Website URL',
  })
  website?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'GST identification number',
  })
  gst_number?: string | null;

  @ApiPropertyOptional({
    enum: BusinessStatus,
    description: 'Status of the business (Admin only)',
  })
  status?: BusinessStatus;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether the business is featured (Admin only)',
  })
  is_featured?: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Replacement business logo file image',
  })
  business_logo?: any;
}

export const businessQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
  category_id: z.string().optional(),
  is_featured: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  category_name: z.string().optional(),
  slug: z.string().optional(),
  category_description: z.string().optional(),
  business_name: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  gst_number: z.string().optional(),
});

export class BusinessQueryDto {
  @ApiPropertyOptional({
    description:
      'Search keyword matching across business details (name, description, website, gst_number), owner details (full_name, phone, whatsapp, email, address), and category details (name, slug, description)',
    example: 'John Doe',
  })
  q?: string;

  @ApiPropertyOptional({
    description:
      'Alias search keyword matching across business details, owner details, and category details',
    example: 'John Doe',
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by category UUID or slug',
  })
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by featured status',
  })
  is_featured?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by owner full name',
    example: 'John Doe',
  })
  full_name?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner phone number',
    example: '7382772384',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner whatsapp number',
    example: '9876543210',
  })
  whatsapp?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner email address',
    example: 'john.doe@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner address',
    example: '123 Business Street, Tech Park, Hyderabad',
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Filter by category name',
    example: 'Education',
  })
  category_name?: string;

  @ApiPropertyOptional({
    description: 'Filter by category slug',
    example: 'education',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Filter by category description',
  })
  category_description?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific business name',
    example: 'Tech Solutions India Pvt Ltd',
  })
  business_name?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific business description',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Filter by business website URL',
    example: 'https://techsolutions.in',
  })
  website?: string;

  @ApiPropertyOptional({
    description: 'Filter by GST number',
    example: '36AAAAA0000A1Z5',
  })
  gst_number?: string;
}

