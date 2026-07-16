import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
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
    const whereCondition: FindOptionsWhere<Notification> = {};
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
    user_id?: string;
    phone?: string;
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>;
  }): Promise<Notification> {
    let targetUserId = data.user_id;

    const isUuid = (str?: string) =>
      !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const phoneToLookup = data.phone || (!isUuid(targetUserId) ? targetUserId : undefined);

    if (phoneToLookup) {
      const user = await this.userRepository.findOne({
        where: { phone: phoneToLookup.trim() },
      });
      if (!user) {
        throw new NotFoundException(`User with phone ${phoneToLookup} not found`);
      }
      targetUserId = user.id;
    }

    if (!targetUserId || !isUuid(targetUserId)) {
      throw new NotFoundException('Target user ID or valid phone number could not be resolved');
    }

    const notif = this.notificationRepository.create({
      user_id: targetUserId,
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
    user_ids?: string[];
    phones?: string[];
    title: string;
    message: string;
    type: NotificationType;
    data?: Record<string, any>;
  }): Promise<{ count: number; user_ids: string[]; message: string }> {
    const isUuid = (str?: string) =>
      !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const inputIds = data.user_ids || [];
    const inputPhones = data.phones || [];

    const uuidList: string[] = inputIds.filter((id) => isUuid(id));
    const phoneList: string[] = [
      ...inputPhones,
      ...inputIds.filter((id) => !isUuid(id)),
    ].map((p) => p.trim()).filter((p) => p.length > 0);

    const targetUserIdsSet = new Set<string>(uuidList);

    if (phoneList.length > 0) {
      const users = await this.userRepository.find({
        where: { phone: In(phoneList) },
        select: { id: true, phone: true },
      });
      for (const u of users) {
        targetUserIdsSet.add(u.id);
      }
    }

    const targetUserIds = Array.from(targetUserIdsSet);
    if (targetUserIds.length === 0) {
      return {
        count: 0,
        user_ids: [],
        message: 'No valid target users found for the provided phone numbers or IDs.',
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

    const savedNotifications =
      await this.notificationRepository.save(notificationsToSave);

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

    const savedNotifications =
      await this.notificationRepository.save(notificationsToSave);

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
    const isNewOrReactivated = !device || !device.is_active;
    let otherActiveDevicesCount = 0;
    if (isNewOrReactivated) {
      otherActiveDevicesCount = await this.deviceRepository.count({
        where: { user_id: user.id, is_active: true },
      });
    }

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
    const savedDevice = await this.deviceRepository.save(device);

    if (isNewOrReactivated && otherActiveDevicesCount >= 1) {
      const deviceDisplayName =
        savedDevice.device_name || savedDevice.device_type || 'Unknown Device';
      const totalActiveDevices = otherActiveDevicesCount + 1;
      await this.create({
        user_id: user.id,
        title: 'Security Alert: New Device Registered',
        message: `A new device (${deviceDisplayName}) was registered to your BizzDeal account. You now have ${totalActiveDevices} active devices receiving notifications.`,
        type: NotificationType.GENERAL,
        data: {
          event: 'multiple_devices_registered',
          device_id: savedDevice.id,
          device_type: savedDevice.device_type,
          device_name: savedDevice.device_name || '',
          total_active_devices: totalActiveDevices,
        },
      });
    }

    return savedDevice;
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
