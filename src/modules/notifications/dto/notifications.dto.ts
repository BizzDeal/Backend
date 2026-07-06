import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, NotificationType, UserRole } from '../../../common/enums';

export class CreateNotificationDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'UUID of the target recipient user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    type: String,
    description: 'Title of the notification alert',
    example: 'New Offer Received!',
  })
  title: string;

  @ApiProperty({
    type: String,
    description: 'Detailed notification message content',
    example: 'You have received a 20% discount offer from TechStore.',
  })
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    default: NotificationType.GENERAL,
    description: 'Type classification of the notification',
    example: NotificationType.GENERAL,
  })
  type?: NotificationType;

  @ApiPropertyOptional({
    type: Object,
    description: 'Optional custom JSON metadata payload',
    example: { offer_id: '89a01234-b56c-78d9-e012-345678901234', discount: 20 },
  })
  data?: Record<string, any>;
}

export class BroadcastNotificationDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Array of target recipient user UUIDs (when targeting specific members or customers)',
    example: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
  })
  user_ids?: string[];

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Target user role to broadcast notification to all members or customers platform-wide (e.g. MEMBER, CUSTOMER). Admin only.',
    example: UserRole.MEMBER,
  })
  target_role?: UserRole;

  @ApiProperty({
    type: String,
    description: 'Title of the notification alert',
    example: '🔥 Special Weekend Discount for All Members!',
  })
  title: string;

  @ApiProperty({
    type: String,
    description: 'Detailed notification message content',
    example: 'Enjoy an exclusive 30% discount across all BizzDeal partner stores this weekend!',
  })
  message: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    default: NotificationType.GENERAL,
    description: 'Type classification of the notification',
    example: NotificationType.GENERAL,
  })
  type?: NotificationType;

  @ApiPropertyOptional({
    type: Object,
    description: 'Optional custom JSON metadata payload',
    example: { offer_id: '89a01234-b56c-78d9-e012-345678901234', discount: 30 },
  })
  data?: Record<string, any>;
}

export class RegisterDeviceDto {
  @ApiProperty({
    type: String,
    description: 'Firebase Cloud Messaging (FCM) registration token from client device',
    example: 'cE9...fcm_token_string...xY0',
  })
  fcm_token: string;

  @ApiProperty({
    enum: DeviceType,
    description: 'Operating system or platform type of the client device',
    example: DeviceType.ANDROID,
  })
  device_type: DeviceType;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional human-readable name or model of the device',
    example: 'Samsung Galaxy S23 Ultra',
  })
  device_name?: string;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Filter notifications by recipient user UUID (Admin only)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter notifications by read status (true for read, false for unread)',
    example: false,
  })
  is_read?: boolean;

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Filter notifications by specific notification type',
    example: NotificationType.GENERAL,
  })
  type?: NotificationType;
}
