import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../../../common/enums';

export class SendMessageWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the target conversation',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversation_id: string;

  @ApiPropertyOptional({
    description: 'Text content of the message (required if message_type is TEXT)',
    type: String,
    example: 'Hello! Checking in on the deal.',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Type of the message being sent',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  message_type?: MessageType;

  @ApiPropertyOptional({
    description:
      'UUID of an uploaded media file (required if message_type is IMAGE, VOICE, or FILE)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  media_file_id?: string;
}

export class EditMessageWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the message to edit',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  message_id: string;

  @ApiProperty({
    description: 'New text content for the message',
    type: String,
    example: 'Updated text content here.',
  })
  message: string;
}

export class DeleteMessageWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the message to soft-delete',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  message_id: string;
}

export class MarkAsReadWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the conversation to mark as read',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversation_id: string;
}

export class MessageDeliveredWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the delivered message',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  message_id: string;

  @ApiProperty({
    description: 'UUID of the conversation the message belongs to',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversation_id: string;
}

export class TypingWsSwaggerDto {
  @ApiProperty({
    description: 'UUID of the active conversation',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversation_id: string;

  @ApiProperty({
    description:
      'UUID of the recipient user who should see the typing indicator',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  receiver_id: string;
}
