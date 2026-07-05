import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MessageType } from '../../common/enums';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or Get Conversation',
    description: 'Creates a new conversation with another user or returns an existing one.',
  })
  @ApiResponse({ status: 201, description: 'Conversation returned successfully.' })
  async createConversation(@Body() body: { target_user_id: string }, @CurrentUser() user: User) {
    return this.chatService.createConversation(body.target_user_id, user);
  }

  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Conversations',
    description: 'Retrieves all chat conversations for the authenticated user without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Conversations list returned successfully.' })
  async findConversations(@CurrentUser() user: User) {
    return this.chatService.findConversations(user);
  }

  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Conversation By ID',
    description: 'Retrieves details of a specific conversation by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Conversation details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getConversationById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.getConversationById(id, user);
  }

  @Get('conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Messages in Conversation',
    description: 'Retrieves all messages for a specific conversation without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Messages list returned successfully.' })
  async findMessages(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.findMessagesByConversationId(id, user);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send Message',
    description: 'Sends a message to a conversation.',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully.' })
  async sendMessage(
    @Body() body: { conversation_id: string; message?: string; message_type?: MessageType; media_file_id?: string },
    @CurrentUser() user: User,
  ) {
    return this.chatService.sendMessage(
      body.conversation_id,
      body.message || null,
      body.message_type || MessageType.TEXT,
      body.media_file_id || null,
      user,
    );
  }

  @Get('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Message By ID',
    description: 'Retrieves details of a specific chat message by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Message details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  async getMessageById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.getMessageById(id, user);
  }
}
