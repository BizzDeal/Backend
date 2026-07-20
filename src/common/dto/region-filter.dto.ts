import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const regionFilterSchemaBase = {
  states: z.string().optional(),
  districts: z.string().optional(),
};

export class RegionFilterDto {
  @ApiPropertyOptional({
    description: 'Comma-separated list of state UUIDs to filter data by region.',
  })
  states?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of district UUIDs to filter data by region.',
  })
  districts?: string;
}
