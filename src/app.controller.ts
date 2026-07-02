import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health / General')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API service status and info' })
  @ApiResponse({
    status: 200,
    description:
      'Returns service health check status and Swagger documentation link',
  })
  getApiInfo() {
    return this.appService.getApiInfo();
  }
}
