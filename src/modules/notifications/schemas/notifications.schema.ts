import { z } from 'zod';
import { DeviceType, NotificationType } from '../../../common/enums';

export const createNotificationSchema = z.object({
  user_id: z.string().uuid('Invalid user UUID format'),
  title: z.string().min(1, 'Title cannot be empty').max(255, 'Title too long'),
  message: z.string().min(1, 'Message cannot be empty'),
  type: z
    .nativeEnum(NotificationType)
    .optional()
    .default(NotificationType.GENERAL),
  data: z.record(z.string(), z.any()).optional().nullable(),
});

export const registerDeviceSchema = z.object({
  fcm_token: z.string().min(1, 'FCM token is required'),
  device_type: z.nativeEnum(DeviceType, {
    message: 'Invalid device type',
  }),
  device_name: z.string().max(255).optional().nullable(),
});

export const notificationQuerySchema = z.object({
  is_read: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }),
  type: z.nativeEnum(NotificationType).optional(),
});
