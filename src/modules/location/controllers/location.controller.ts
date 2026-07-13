import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LocationService } from '../services/location.service';
import { LocationQueryDto } from '../dto/location-query.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('states')
  @ApiOperation({ summary: 'Get all states and union territories (searchable)' })
  @ApiResponse({ status: 200, description: 'List of states returned successfully' })
  async getStates(@Query() query: LocationQueryDto) {
    return this.locationService.getStates(query);
  }

  @Get('states/:stateId/districts')
  @ApiOperation({ summary: 'Get all districts belonging to a specific state ID' })
  @ApiParam({ name: 'stateId', type: String, description: 'UUID of the State' })
  @ApiResponse({ status: 200, description: 'List of districts returned successfully' })
  async getDistrictsByState(@Param('stateId') stateId: string, @Query() query: LocationQueryDto) {
    return this.locationService.getDistrictsByState(stateId, query);
  }
}
