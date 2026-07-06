jest.mock('../src/common/firebase/firebase.service', () => ({
  FirebaseService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      staleTokens: [],
    }),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { NotificationsModule } from '../src/modules/notifications/notifications.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { UserDevice } from '../src/modules/notifications/entities/user-device.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { FirebaseService } from '../src/common/firebase/firebase.service';
import { UserRole, NotificationType, DeviceType } from '../src/common/enums';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: UserRole.MEMBER,
    phone: '9876543210',
  } as User;

  const mockNotification = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    user_id: mockUser.id,
    title: 'E2E Test Notification',
    message: 'Testing FCM Push',
    type: NotificationType.GENERAL,
    data: { key: 'value' },
    is_read: false,
    read_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDevice = {
    id: '323e4567-e89b-12d3-a456-426614174000',
    user_id: mockUser.id,
    fcm_token: 'e2e_token_sample',
    device_type: DeviceType.WEB,
    device_name: 'Chrome Browser',
    is_active: true,
    last_used_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockNotificationRepo = {
    find: jest.fn().mockResolvedValue([mockNotification]),
    findOne: jest.fn().mockResolvedValue(mockNotification),
    create: jest.fn().mockReturnValue(mockNotification),
    save: jest.fn().mockResolvedValue(mockNotification),
    remove: jest.fn().mockResolvedValue(mockNotification),
  };

  const mockDeviceRepo = {
    find: jest.fn().mockResolvedValue([mockDevice]),
    findOne: jest.fn().mockResolvedValue(mockDevice),
    create: jest.fn().mockReturnValue(mockDevice),
    save: jest.fn().mockResolvedValue(mockDevice),
    delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }),
  };

  const mockFirebaseService = {
    sendPushNotification: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      staleTokens: [],
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(getRepositoryToken(Notification))
      .useValue(mockNotificationRepo)
      .overrideProvider(getRepositoryToken(UserDevice))
      .useValue(mockDeviceRepo)
      .overrideProvider(FirebaseService)
      .useValue(mockFirebaseService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /notifications', () => {
    it('should return list of notifications', () => {
      return request(app.getHttpServer())
        .get('/notifications')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].id).toBe(mockNotification.id);
        });
    });
  });

  describe('POST /notifications', () => {
    it('should create notification and trigger FCM push', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .send({
          user_id: mockUser.id,
          title: 'E2E Test Notification',
          message: 'Testing FCM Push',
          type: NotificationType.GENERAL,
          data: { key: 'value' },
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.id).toBe(mockNotification.id);
          expect(mockFirebaseService.sendPushNotification).toHaveBeenCalled();
        });
    });

    it('should fail validation when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .send({
          title: 'No User ID',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('POST /notifications/devices', () => {
    it('should register a push device token', () => {
      return request(app.getHttpServer())
        .post('/notifications/devices')
        .send({
          fcm_token: 'e2e_token_sample',
          device_type: DeviceType.WEB,
          device_name: 'Chrome Browser',
        })
        .expect(HttpStatus.CREATED)
        .expect((res) => {
          expect(res.body.fcm_token).toBe(mockDevice.fcm_token);
        });
    });

    it('should fail validation when fcm_token is empty', () => {
      return request(app.getHttpServer())
        .post('/notifications/devices')
        .send({
          fcm_token: '',
          device_type: DeviceType.WEB,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should mark notification as read', () => {
      return request(app.getHttpServer())
        .put(`/notifications/${mockNotification.id}/read`)
        .expect(HttpStatus.OK);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should delete notification', () => {
      return request(app.getHttpServer())
        .delete(`/notifications/${mockNotification.id}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toBe('Notification deleted successfully');
        });
    });
  });
});
