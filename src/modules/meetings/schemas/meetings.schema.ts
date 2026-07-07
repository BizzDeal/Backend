import { z } from 'zod';
import { MeetingStatus, AttendeeStatus } from '../../../common/enums';

export const createMeetingSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string().optional(),
  meeting_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'meeting_date must be a valid date-time string',
  }),
  location: z.string().optional(),
  meeting_link: z.string().optional(),
  business_id: z
    .string()
    .uuid({ message: 'business_id must be a valid UUID' })
    .optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1, { message: 'Title cannot be empty' }).optional(),
  description: z.string().optional(),
  meeting_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'meeting_date must be a valid date-time string',
    })
    .optional(),
  location: z.string().optional(),
  meeting_link: z.string().optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
});

export const addAttendeeSchema = z.object({
  user_id: z.string().uuid({ message: 'user_id must be a valid UUID' }),
});

export const updateAttendeeStatusSchema = z.object({
  status: z.nativeEnum(AttendeeStatus, {
    message:
      'status must be one of INVITED, ACCEPTED, REJECTED, ATTENDED, MISSED',
  }),
});

export const meetingQuerySchema = z.object({
  status: z.nativeEnum(MeetingStatus).optional(),
  business_id: z
    .string()
    .uuid({ message: 'business_id must be a valid UUID' })
    .optional(),
  from_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'from_date must be a valid date-time string',
    })
    .optional(),
  to_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'to_date must be a valid date-time string',
    })
    .optional(),
});
