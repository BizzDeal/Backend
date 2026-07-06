import { z } from 'zod';
import { DeviceType, NotificationType, UserRole } from '../../../common/enums';

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

export const broadcastNotificationSchema = z
  .object({
    user_ids: z.array(z.string().uuid('Invalid user UUID format')).optional(),
    target_role: z.nativeEnum(UserRole).optional(),
    title: z.string().min(1, 'Title cannot be empty').max(255, 'Title too long'),
    message: z.string().min(1, 'Message cannot be empty'),
    type: z
      .nativeEnum(NotificationType)
      .optional()
      .default(NotificationType.GENERAL),
    data: z.record(z.string(), z.any()).optional().nullable(),
  })
  .refine(
    (data) =>
      (data.user_ids && data.user_ids.length > 0) || data.target_role !== undefined,
    {
      message:
        'Must provide either a non-empty user_ids array or target_role (e.g. MEMBER or CUSTOMER)',
      path: ['user_ids'],
    },
  );

export const registerDeviceSchema = z.object({
  fcm_token: z.string().min(1, 'FCM token is required'),
  device_type: z.nativeEnum(DeviceType, {
    message: 'Invalid device type',
  }),
  device_name: z.string().max(255).optional().nullable(),
});

export const notificationQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
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
