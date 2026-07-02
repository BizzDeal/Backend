import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getApiInfo', () => {
    it('should return API service info', () => {
      const res = appController.getApiInfo();
      expect(res).toBeDefined();
      expect(res.service).toBe('BizzDeal Backend API');
      expect(res.status).toBe('online');
    });
  });
});
