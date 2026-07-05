import { z } from 'zod';
import { MessageType } from '../../../common/enums';

export const SendMessageWsSchema = z
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

export type SendMessageWsDto = z.infer<typeof SendMessageWsSchema>;

export const MessageDeliveredWsSchema = z.object({
  message_id: z.string().uuid({ message: 'message_id must be a valid UUID' }),
  conversation_id: z
    .string()
    .uuid({ message: 'conversation_id must be a valid UUID' }),
});

export type MessageDeliveredWsDto = z.infer<typeof MessageDeliveredWsSchema>;

export const MarkAsReadWsSchema = z.object({
  conversation_id: z
    .string()
    .uuid({ message: 'conversation_id must be a valid UUID' }),
});

export type MarkAsReadWsDto = z.infer<typeof MarkAsReadWsSchema>;

export const TypingWsSchema = z.object({
  conversation_id: z
    .string()
    .uuid({ message: 'conversation_id must be a valid UUID' }),
  receiver_id: z.string().uuid({ message: 'receiver_id must be a valid UUID' }),
});

export type TypingWsDto = z.infer<typeof TypingWsSchema>;
