import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  SendMessageWsSwaggerDto,
  EditMessageWsSwaggerDto,
  DeleteMessageWsSwaggerDto,
  MarkAsReadWsSwaggerDto,
  MessageDeliveredWsSwaggerDto,
  TypingWsSwaggerDto,
} from './dto/chat-ws-swagger.dto';

@ApiTags('Chat - WebSocket Events (Reference Docs Only)')
@ApiBearerAuth()
@Controller('chat/ws-docs')
export class ChatWsDocsController {
  @Post('send_message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: send_message',
    description:
      'Emit this event to the `/chat` Socket.IO namespace to send a message. Requires JWT authentication in socket query or auth header.\n\n**Server Broadcasts:**\n- Emits `receive_message` (full ChatMessage object) to the recipient user room (`user_<recipient_id>`).\n- Returns an acknowledgment object `{ status: "SENT", message_id: "<uuid>", created_at: "<timestamp>", message: { ... } }` to the sender.',
  })
  @ApiBody({ type: SendMessageWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description:
      'Acknowledgment returned by server: `{ status: "SENT", message_id: "uuid", created_at: "timestamp", message: { ... } }`',
  })
  async documentSendMessage(@Body() _body: SendMessageWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }

  @Post('edit_message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: edit_message',
    description:
      'Emit this event to edit an existing message text. Only the original sender can edit their message.\n\n**Server Broadcasts:**\n- Emits `message_edited` (updated ChatMessage object) to both conversation participants.',
  })
  @ApiBody({ type: EditMessageWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description: 'Server emits `message_edited` event to room participants.',
  })
  async documentEditMessage(@Body() _body: EditMessageWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }

  @Post('delete_message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: delete_message',
    description:
      'Emit this event to soft-delete a message (sets `is_deleted = true` and clears text/media). Only the sender or an ADMIN can delete a message.\n\n**Server Broadcasts:**\n- Emits `message_deleted` `{ message_id: "<uuid>", conversation_id: "<uuid>" }` to both conversation participants.',
  })
  @ApiBody({ type: DeleteMessageWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description: 'Server emits `message_deleted` event to room participants.',
  })
  async documentDeleteMessage(@Body() _body: DeleteMessageWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }

  @Post('mark_as_read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: mark_as_read',
    description:
      'Emit this event when a user opens or reads a conversation to mark all incoming unread messages as read.\n\n**Server Broadcasts:**\n- Emits `messages_read` `{ conversation_id: "<uuid>", read_by: "<user_id>", read_at: "<timestamp>" }` to the conversation partner (turns checkmarks blue).',
  })
  @ApiBody({ type: MarkAsReadWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description:
      'Server emits `messages_read` event to conversation partner.',
  })
  async documentMarkAsRead(@Body() _body: MarkAsReadWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }

  @Post('message_delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: message_delivered',
    description:
      'Emit this event immediately when a client receives a `receive_message` event in real time.\n\n**Server Broadcasts:**\n- Emits `message_status_update` `{ message_id: "<uuid>", conversation_id: "<uuid>", status: "DELIVERED" }` to the original sender (turns single checkmark into double grey checkmarks).',
  })
  @ApiBody({ type: MessageDeliveredWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description:
      'Server emits `message_status_update` event to original sender.',
  })
  async documentMessageDelivered(@Body() _body: MessageDeliveredWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }

  @Post('typing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Socket Event: typing / stop_typing',
    description:
      'Emit `typing` or `stop_typing` when the user starts or stops typing in an active conversation input box.\n\n**Server Broadcasts:**\n- Emits `user_typing` or `user_stop_typing` `{ conversation_id: "<uuid>", user_id: "<sender_id>" }` to the recipient.',
  })
  @ApiBody({ type: TypingWsSwaggerDto })
  @ApiResponse({
    status: 200,
    description:
      'Server emits `user_typing` or `user_stop_typing` to recipient.',
  })
  async documentTyping(@Body() _body: TypingWsSwaggerDto) {
    return { status: 'REFERENCE_ONLY' };
  }
}
