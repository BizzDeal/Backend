import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      service: 'BizzDeal Backend API',
      version: '1.0.0',
      status: 'online',
      swaggerDocumentation: '/bizzdeal/swagger/api',
      timestamp: new Date().toISOString(),
    };
  }
}
