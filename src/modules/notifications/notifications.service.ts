import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserDevice } from './entities/user-device.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, NotificationType, DeviceType } from '../../common/enums';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { NotificationQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(UserDevice)
    private readonly deviceRepository: Repository<UserDevice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly firebaseService: FirebaseService,
  ) {}

  async findAll(
    user: User,
    query?: NotificationQueryDto,
  ): Promise<Notification[]> {
    const whereCondition: any = {};
    if (user.role !== UserRole.ADMIN) {
      whereCondition.user_id = user.id;
    } else if (query?.user_id) {
      whereCondition.user_id = query.user_id;
    }
    if (query?.is_read !== undefined) {
      whereCondition.is_read = query.is_read;
    }
    if (query?.type !== undefined) {
      whereCondition.type = query.type;
    }

    return this.notificationRepository.find({
      where: whereCondition,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Notification> {
    const notif = await this.notificationRepository.findOne({ where: { id } });
    if (!notif) {
      throw new NotFoundException('Notification not found');
    }
    if (user.role !== UserRole.ADMIN && notif.user_id !== user.id) {
      throw new ForbiddenException('No permission to view this notification');
    }
    return notif;
  }

  async create(data: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>;
  }): Promise<Notification> {
    const notif = this.notificationRepository.create({
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      type: data.type || NotificationType.GENERAL,
      data: data.data || null,
    });
    const savedNotif = await this.notificationRepository.save(notif);

    // Dispatch universal FCM push notification asynchronously
    this.dispatchFcmPush(savedNotif).catch((err) => {
      this.logger.error(
        `Error in background FCM push dispatch for notification ${savedNotif.id}: ${err instanceof Error ? err.message : err}`,
      );
    });

    return savedNotif;
  }

  private async dispatchFcmPush(notification: Notification): Promise<void> {
    const activeDevices = await this.deviceRepository.find({
      where: { user_id: notification.user_id, is_active: true },
    });

    if (!activeDevices || activeDevices.length === 0) {
      return;
    }

    const tokens = activeDevices.map((d) => d.fcm_token);
    const result = await this.firebaseService.sendPushNotification(
      tokens,
      notification.title,
      notification.message,
      {
        notification_id: notification.id,
        type: notification.type,
        ...(notification.data || {}),
      },
    );

    // Automatic cleanup of stale or invalid FCM registration tokens
    if (result.staleTokens && result.staleTokens.length > 0) {
      for (const staleToken of result.staleTokens) {
        await this.deviceRepository.delete({
          user_id: notification.user_id,
          fcm_token: staleToken,
        });
        this.logger.warn(
          `Removed stale/invalid FCM registration token for user ${notification.user_id}`,
        );
      }
    }
  }

  async sendBulkToUsers(data: {
    user_ids: string[];
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>;
  }): Promise<{ count: number; user_ids: string[]; message: string }> {
    const targetUserIds = Array.from(new Set(data.user_ids));
    if (targetUserIds.length === 0) {
      return {
        count: 0,
        user_ids: [],
        message: 'No valid target user IDs provided.',
      };
    }

    const notificationsToSave = targetUserIds.map((userId) =>
      this.notificationRepository.create({
        user_id: userId,
        title: data.title,
        message: data.message,
        type: data.type || NotificationType.GENERAL,
        data: data.data || null,
      }),
    );

    const savedNotifications = await this.notificationRepository.save(
      notificationsToSave,
    );

    this.dispatchBulkFcmPush(savedNotifications).catch((err) => {
      this.logger.error(
        `Error in background bulk FCM push dispatch: ${err instanceof Error ? err.message : err}`,
      );
    });

    return {
      count: savedNotifications.length,
      user_ids: targetUserIds,
      message: `Successfully created notifications and initiated FCM push dispatch for ${savedNotifications.length} user(s).`,
    };
  }

  async broadcastToRole(
    role: UserRole,
    data: {
      title: string;
      message: string;
      type: NotificationType;
      data?: Record<string, any>;
    },
    actor: User,
  ): Promise<{ count: number; role: UserRole; message: string }> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        `Only administrators can broadcast notifications to all ${role.toLowerCase()}s platform-wide.`,
      );
    }

    const usersWithRole = await this.userRepository.find({
      where: { role },
      select: { id: true },
    });
    const targetUserIds = usersWithRole.map((u) => u.id);

    if (targetUserIds.length === 0) {
      return {
        count: 0,
        role,
        message: `No users found with role ${role}.`,
      };
    }

    const notificationsToSave = targetUserIds.map((userId) =>
      this.notificationRepository.create({
        user_id: userId,
        title: data.title,
        message: data.message,
        type: data.type || NotificationType.GENERAL,
        data: data.data || null,
      }),
    );

    const savedNotifications = await this.notificationRepository.save(
      notificationsToSave,
    );

    this.dispatchBulkFcmPush(savedNotifications).catch((err) => {
      this.logger.error(
        `Error in background role broadcast FCM push dispatch: ${err instanceof Error ? err.message : err}`,
      );
    });

    return {
      count: savedNotifications.length,
      role,
      message: `Successfully created notifications and initiated FCM push dispatch for ${savedNotifications.length} ${role.toLowerCase()}(s).`,
    };
  }

  private async dispatchBulkFcmPush(
    notifications: Notification[],
  ): Promise<void> {
    if (!notifications || notifications.length === 0) {
      return;
    }

    const userIds = Array.from(new Set(notifications.map((n) => n.user_id)));
    const activeDevices = await this.deviceRepository.find({
      where: { user_id: In(userIds), is_active: true },
    });

    if (!activeDevices || activeDevices.length === 0) {
      return;
    }

    const devicesByUser = new Map<string, string[]>();
    for (const d of activeDevices) {
      const existing = devicesByUser.get(d.user_id) || [];
      existing.push(d.fcm_token);
      devicesByUser.set(d.user_id, existing);
    }

    for (const notif of notifications) {
      const userTokens = devicesByUser.get(notif.user_id);
      if (userTokens && userTokens.length > 0) {
        await this.firebaseService
          .sendPushNotification(userTokens, notif.title, notif.message, {
            notification_id: notif.id,
            type: notif.type,
            ...(notif.data || {}),
          })
          .then(async (result) => {
            if (result.staleTokens && result.staleTokens.length > 0) {
              for (const staleToken of result.staleTokens) {
                await this.deviceRepository.delete({
                  user_id: notif.user_id,
                  fcm_token: staleToken,
                });
                this.logger.warn(
                  `Removed stale/invalid FCM registration token for user ${notif.user_id}`,
                );
              }
            }
          })
          .catch((err) => {
            this.logger.error(
              `Failed to dispatch push to user ${notif.user_id}: ${err instanceof Error ? err.message : err}`,
            );
          });
      }
    }
  }

  async markAsRead(id: string, user: User): Promise<Notification> {
    const notif = await this.findOne(id, user);
    notif.is_read = true;
    notif.read_at = new Date();
    return this.notificationRepository.save(notif);
  }

  async remove(id: string, user: User): Promise<void> {
    const notif = await this.findOne(id, user);
    await this.notificationRepository.remove(notif);
  }

  async registerDevice(
    fcmToken: string,
    deviceType: DeviceType,
    deviceName: string | null | undefined,
    user: User,
  ): Promise<UserDevice> {
    let device = await this.deviceRepository.findOne({
      where: { user_id: user.id, fcm_token: fcmToken },
    });
    if (!device) {
      device = this.deviceRepository.create({
        user_id: user.id,
        fcm_token: fcmToken,
        device_type: deviceType || DeviceType.ANDROID,
        device_name: deviceName || null,
        is_active: true,
        last_used_at: new Date(),
      });
    } else {
      device.is_active = true;
      device.device_type = deviceType || device.device_type;
      if (deviceName !== undefined) {
        device.device_name = deviceName || null;
      }
      device.last_used_at = new Date();
    }
    return this.deviceRepository.save(device);
  }

  async getDevices(user: User): Promise<UserDevice[]> {
    return this.deviceRepository.find({
      where: { user_id: user.id },
      order: { created_at: 'DESC' },
    });
  }

  async getDeviceById(id: string, user: User): Promise<UserDevice> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException('User device not found');
    }
    if (user.role !== UserRole.ADMIN && device.user_id !== user.id) {
      throw new ForbiddenException('No permission to view this device');
    }
    return device;
  }
}
