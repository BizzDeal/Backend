import { z } from 'zod';
import { MessageType } from '../../../common/enums';

export const createConversationSchema = z.object({
  target_user_id: z
    .string()
    .uuid({ message: 'target_user_id must be a valid UUID' }),
});

export const sendMessageSchema = z
  .object({
    conversation_id: z
      .string()
      .uuid({ message: 'conversation_id must be a valid UUID' }),
    message: z.string().nullable().optional(),
    message_type: z
      .nativeEnum(MessageType)
      .optional()
      .default(MessageType.TEXT),
    media_file_id: z
      .string()
      .uuid({ message: 'media_file_id must be a valid UUID' })
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.message_type === MessageType.TEXT) {
        return !!data.message && data.message.trim().length > 0;
      }
      return (
        !!data.media_file_id ||
        (!!data.message && data.message.trim().length > 0)
      );
    },
    {
      message:
        'TEXT messages require a message string; media messages require media_file_id or a caption',
    },
  );

export const editMessageSchema = z.object({
  message: z.string().min(1, { message: 'Message cannot be empty' }),
});
