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

  @Get('health')
  @ApiOperation({ summary: 'Simple health check for deployment platforms' })
  @ApiResponse({ status: 200, description: 'Returns OK' })
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
