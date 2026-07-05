import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../../../common/enums';

export class CreateConversationDto {
  @ApiProperty({
    description: 'UUID of the target user to start a conversation with',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  target_user_id: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'UUID of the conversation to send the message to',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversation_id: string;

  @ApiPropertyOptional({
    description: 'Text content of the message',
    type: String,
    example: 'Hello, how are you?',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Type of the message',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  message_type?: MessageType;

  @ApiPropertyOptional({
    description:
      'UUID of the uploaded media file (if sending an image, document, or voice note)',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  media_file_id?: string;
}
