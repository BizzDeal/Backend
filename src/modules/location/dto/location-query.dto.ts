import { ApiPropertyOptional } from '@nestjs/swagger';

export class LocationQueryDto {
  @ApiPropertyOptional({
    description: 'Search term to filter location names by partial match',
    type: String,
  })
  search?: string;
}
