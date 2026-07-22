import { z } from 'zod';
import { DeviceType, NotificationType, UserRole } from '../../../common/enums';

export const createNotificationSchema = z.object({
  user_id: z.string().optional(),
  phone: z.string().min(5, 'Phone number invalid').optional(),
  title: z.string().min(1, 'Title cannot be empty').max(255, 'Title too long'),
  message: z.string().min(1, 'Message cannot be empty'),
  type: z
    .nativeEnum(NotificationType)
    .optional()
    .default(NotificationType.GENERAL),
  data: z.record(z.string(), z.any()).optional().nullable(),
}).refine((data) => !!(data.user_id || data.phone), {
  message: 'Either user_id or phone must be provided',
  path: ['phone'],
});

export const sendBulkNotificationSchema = z.object({
  user_ids: z
    .array(z.string())
    .optional()
    .default([]),
  phones: z
    .array(z.string().min(5, 'Phone number invalid'))
    .optional()
    .default([]),
  title: z.string().min(1, 'Title cannot be empty').max(255, 'Title too long'),
  message: z.string().min(1, 'Message cannot be empty'),
  type: z
    .nativeEnum(NotificationType)
    .optional()
    .default(NotificationType.GENERAL),
  data: z.record(z.string(), z.any()).optional().nullable(),
}).refine((data) => (data.user_ids && data.user_ids.length > 0) || (data.phones && data.phones.length > 0), {
  message: 'Must provide at least one user_id or phone',
  path: ['phones'],
});

export const broadcastRoleNotificationSchema = z.object({
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
  device_model: z.string().max(255).optional().nullable(),
  operating_system: z.string().max(255).optional().nullable(),
  os_version: z.string().max(255).optional().nullable(),
  manufacturer: z.string().max(255).optional().nullable(),
  is_virtual: z.boolean().optional().nullable(),
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
