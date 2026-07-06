jest.mock('../../common/firebase/firebase.service', () => ({
  FirebaseService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { UserDevice } from './entities/user-device.entity';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { UserRole, NotificationType, DeviceType } from '../../common/enums';
import { User } from '../users/entities/user.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: jest.Mocked<Repository<Notification>>;
  let deviceRepo: jest.Mocked<Repository<UserDevice>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let firebaseService: jest.Mocked<FirebaseService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    role: UserRole.MEMBER,
    phone: '9876543210',
  } as User;

  const mockAdmin: User = {
    id: '023e4567-e89b-12d3-a456-426614174000',
    role: UserRole.ADMIN,
    phone: '9999999999',
  } as User;

  const mockNotification = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    user_id: mockUser.id,
    title: 'Test Alert',
    message: 'Hello World',
    type: NotificationType.GENERAL,
    data: { foo: 'bar' },
    is_read: false,
    read_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as Notification;

  const mockDevice = {
    id: '323e4567-e89b-12d3-a456-426614174000',
    user_id: mockUser.id,
    fcm_token: 'fcm_token_sample_123',
    device_type: DeviceType.ANDROID,
    device_name: 'Test Phone',
    is_active: true,
    last_used_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  } as UserDevice;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            sendPushNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    deviceRepo = module.get(getRepositoryToken(UserDevice));
    userRepo = module.get(getRepositoryToken(User));
    firebaseService = module.get(FirebaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create and FCM push dispatch', () => {
    it('should create notification and dispatch FCM push to active devices', async () => {
      notificationRepo.create.mockReturnValue(mockNotification);
      notificationRepo.save.mockResolvedValue(mockNotification);
      deviceRepo.find.mockResolvedValue([mockDevice]);
      firebaseService.sendPushNotification.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        staleTokens: [],
      });

      const result = await service.create({
        user_id: mockUser.id,
        title: 'Test Alert',
        message: 'Hello World',
        type: NotificationType.GENERAL,
        data: { foo: 'bar' },
      });

      expect(result).toEqual(mockNotification);
      expect(notificationRepo.save).toHaveBeenCalledWith(mockNotification);

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(deviceRepo.find).toHaveBeenCalledWith({
        where: { user_id: mockUser.id, is_active: true },
      });
      expect(firebaseService.sendPushNotification).toHaveBeenCalledWith(
        [mockDevice.fcm_token],
        'Test Alert',
        'Hello World',
        {
          notification_id: mockNotification.id,
          type: NotificationType.GENERAL,
          foo: 'bar',
        },
      );
    });

    it('should clean up stale FCM tokens if returned by FirebaseService', async () => {
      notificationRepo.create.mockReturnValue(mockNotification);
      notificationRepo.save.mockResolvedValue(mockNotification);
      deviceRepo.find.mockResolvedValue([mockDevice]);
      firebaseService.sendPushNotification.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        staleTokens: [mockDevice.fcm_token],
      });
      deviceRepo.delete.mockResolvedValue({ raw: [], affected: 1 });

      await service.create({
        user_id: mockUser.id,
        title: 'Test Alert',
        message: 'Hello World',
        type: NotificationType.GENERAL,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(deviceRepo.delete).toHaveBeenCalledWith({
        user_id: mockUser.id,
        fcm_token: mockDevice.fcm_token,
      });
    });
  });

  describe('findAll', () => {
    it('should filter by user_id for non-admin users', async () => {
      notificationRepo.find.mockResolvedValue([mockNotification]);
      const result = await service.findAll(mockUser);
      expect(result).toEqual([mockNotification]);
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        order: { created_at: 'DESC' },
      });
    });

    it('should not restrict by user_id for admin users unless specified', async () => {
      notificationRepo.find.mockResolvedValue([mockNotification]);
      await service.findAll(mockAdmin, { is_read: false });
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { is_read: false },
        order: { created_at: 'DESC' },
      });
    });

    it('should filter by query.user_id for admin users when specified', async () => {
      notificationRepo.find.mockResolvedValue([mockNotification]);
      await service.findAll(mockAdmin, { user_id: mockUser.id });
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findOne, markAsRead, and remove', () => {
    it('should return notification if user is owner', async () => {
      notificationRepo.findOne.mockResolvedValue(mockNotification);
      const result = await service.findOne(mockNotification.id, mockUser);
      expect(result).toEqual(mockNotification);
    });

    it('should throw ForbiddenException if non-owner tries to view', async () => {
      const otherUser = { id: '99999999-9999-9999-9999-999999999999', role: UserRole.MEMBER } as User;
      notificationRepo.findOne.mockResolvedValue(mockNotification);
      await expect(service.findOne(mockNotification.id, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should mark notification as read', async () => {
      notificationRepo.findOne.mockResolvedValue({ ...mockNotification, is_read: false });
      notificationRepo.save.mockImplementation(async (notif) => notif as Notification);

      const result = await service.markAsRead(mockNotification.id, mockUser);
      expect(result.is_read).toBe(true);
      expect(result.read_at).toBeInstanceOf(Date);
    });

    it('should remove notification', async () => {
      notificationRepo.findOne.mockResolvedValue(mockNotification);
      notificationRepo.remove.mockResolvedValue(mockNotification);

      await service.remove(mockNotification.id, mockUser);
      expect(notificationRepo.remove).toHaveBeenCalledWith(mockNotification);
    });
  });

  describe('registerDevice and getDevices', () => {
    it('should create new device if not exists', async () => {
      deviceRepo.findOne.mockResolvedValue(null);
      deviceRepo.create.mockReturnValue(mockDevice);
      deviceRepo.save.mockResolvedValue(mockDevice);

      const result = await service.registerDevice(
        'fcm_token_sample_123',
        DeviceType.ANDROID,
        'Test Phone',
        mockUser,
      );
      expect(result).toEqual(mockDevice);
      expect(deviceRepo.create).toHaveBeenCalled();
    });

    it('should update existing device if token already exists', async () => {
      deviceRepo.findOne.mockResolvedValue(mockDevice);
      deviceRepo.save.mockResolvedValue({ ...mockDevice, last_used_at: new Date() });

      const result = await service.registerDevice(
        'fcm_token_sample_123',
        DeviceType.ANDROID,
        'Test Phone',
        mockUser,
      );
      expect(deviceRepo.create).not.toHaveBeenCalled();
      expect(deviceRepo.save).toHaveBeenCalled();
    });

    it('should list devices for user', async () => {
      deviceRepo.find.mockResolvedValue([mockDevice]);
      const result = await service.getDevices(mockUser);
      expect(result).toEqual([mockDevice]);
    });
  });

  describe('sendBulkToUsers and broadcastToRole', () => {
    it('should forbid non-admin from broadcasting to role', async () => {
      await expect(
        service.broadcastToRole(
          UserRole.MEMBER,
          {
            title: 'Test',
            message: 'Message',
            type: NotificationType.GENERAL,
          },
          mockUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should send bulk notifications to user_ids successfully', async () => {
      notificationRepo.create.mockReturnValue(mockNotification);
      notificationRepo.save.mockResolvedValue([mockNotification]);
      deviceRepo.find.mockResolvedValue([mockDevice]);
      firebaseService.sendPushNotification.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        staleTokens: [],
      });

      const result = await service.sendBulkToUsers({
        user_ids: [mockUser.id],
        title: 'Test',
        message: 'Message',
        type: NotificationType.GENERAL,
      });

      expect(result.count).toBe(1);
      expect(result.user_ids).toContain(mockUser.id);
      expect(notificationRepo.save).toHaveBeenCalled();
    });
  });
});

