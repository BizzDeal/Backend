import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const paginationQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 20),
    z.number().int().min(1).max(100).default(20),
  ),
});

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    default: 1,
  })
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    maximum: 100,
  })
  limit?: number;
}

export interface PaginatedMeta {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginatedMeta;
}
