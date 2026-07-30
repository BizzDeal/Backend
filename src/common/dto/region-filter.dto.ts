import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const regionFilterSchemaBase = {
  state: z.string().optional(),
  district: z.string().optional(),
};

export class RegionFilterDto {
  @ApiPropertyOptional({
    description: 'Comma-separated list of state UUIDs to filter data by region.',
  })
  state?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of district UUIDs to filter data by region.',
  })
  district?: string;
}
