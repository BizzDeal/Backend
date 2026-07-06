import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { MediaService } from '../media/media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { User } from '../users/entities/user.entity';
import { MessageType, MediaPurpose } from '../../common/enums';
import {
  CreateConversationDto,
  SendMessageDto,
  EditMessageDto,
} from './dto/chat-rest.dto';
import {
  createConversationSchema,
  sendMessageSchema,
  editMessageSchema,
} from './schemas/chat.schema';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly mediaService: MediaService,
  ) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or Get Conversation',
    description:
      'Creates a new conversation with another user or returns an existing one.',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation returned successfully.',
  })
  async createConversation(
    @Body(new ZodValidationPipe(createConversationSchema))
    body: CreateConversationDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.createConversation(body.target_user_id, user);
  }

  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Conversations',
    description:
      'Retrieves all chat conversations for the authenticated user without pagination, including unread message counts. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversations list returned successfully.',
  })
  async findConversations(@CurrentUser() user: User) {
    return this.chatService.findConversations(user);
  }

  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Conversation By ID',
    description:
      'Retrieves details of a specific conversation by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation details returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getConversationById(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.getConversationById(id, user);
  }

  @Put('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark Conversation As Read',
    description:
      'Marks all unread messages in a conversation sent by the other user as read. Returns the count of updated messages and timestamp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages marked as read successfully.',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async markConversationAsRead(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markMessagesAsRead(id, user);
  }

  @Get('conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Messages in Conversation',
    description:
      'Retrieves all messages for a specific conversation without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages list returned successfully.',
  })
  async findMessages(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.findMessagesByConversationId(id, user);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send Message',
    description:
      'Sends a message to a conversation via HTTP REST API and triggers push notifications if recipient is offline.',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully.' })
  async sendMessage(
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageDto,
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
    description:
      'Retrieves details of a specific chat message by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message details returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  async getMessageById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.getMessageById(id, user);
  }

  @Put('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit Message',
    description:
      'Edits the text content of an existing chat message. Only the sender of the message is permitted to edit it.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message edited successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot edit a deleted message or invalid input.',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the sender can edit this message.',
  })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  async editMessage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editMessageSchema)) body: EditMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.editMessage(id, body.message, user);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Message',
    description:
      'Soft-deletes a chat message by setting is_deleted to true and clearing content. Only the sender of the message is permitted to delete it.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the sender can delete this message.',
  })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  async deleteMessage(@Param('id') id: string, @CurrentUser() user: User) {
    return this.chatService.deleteMessage(id, user);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload Chat Media File',
    description:
      'Uploads an image, document, or voice note for use in chat messages. Returns the media file metadata including the UUID to pass as media_file_id when sending a message.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The media file (image, voice note, document) to upload',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Chat media file uploaded successfully.',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.mediaService.saveFile(file, user.id, MediaPurpose.GENERAL);
  }
}
