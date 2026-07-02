import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Business Categories',
    description:
      'Retrieves a list of all active business categories sorted alphabetically.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of business categories successfully retrieved.',
  })
  async getCategories() {
    return this.businessesService.getCategories();
  }
}
