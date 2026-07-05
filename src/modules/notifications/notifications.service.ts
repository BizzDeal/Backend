import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserDevice } from './entities/user-device.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, NotificationType, DeviceType } from '../../common/enums';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(UserDevice)
    private readonly deviceRepository: Repository<UserDevice>,
  ) {}

  async findAll(user: User): Promise<Notification[]> {
    if (user.role === UserRole.ADMIN) {
      return this.notificationRepository.find({
        order: { created_at: 'DESC' },
      });
    }
    return this.notificationRepository.find({
      where: { user_id: user.id },
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
    return this.notificationRepository.save(notif);
  }

  async markAsRead(id: string, user: User): Promise<Notification> {
    const notif = await this.findOne(id, user);
    notif.is_read = true;
    notif.read_at = new Date();
    return this.notificationRepository.save(notif);
  }

  async registerDevice(
    fcmToken: string,
    deviceType: DeviceType,
    deviceName: string | null,
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
