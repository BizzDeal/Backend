import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, MessageType } from '../../common/enums';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  async findConversations(user: User): Promise<ChatConversation[]> {
    if (user.role === UserRole.ADMIN) {
      return this.conversationRepository.find({ order: { updated_at: 'DESC' } });
    }
    return this.conversationRepository.find({
      where: [
        { user_one_id: user.id },
        { user_two_id: user.id },
      ],
      order: { updated_at: 'DESC' },
    });
  }

  async getConversationById(id: string, user: User): Promise<ChatConversation> {
    const conv = await this.conversationRepository.findOne({ where: { id } });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      user.role !== UserRole.ADMIN &&
      conv.user_one_id !== user.id &&
      conv.user_two_id !== user.id
    ) {
      throw new ForbiddenException('No permission to view this conversation');
    }
    return conv;
  }

  async findMessagesByConversationId(conversationId: string, user: User): Promise<ChatMessage[]> {
    await this.getConversationById(conversationId, user);
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });
  }

  async getMessageById(id: string, user: User): Promise<ChatMessage> {
    const msg = await this.messageRepository.findOne({ where: { id } });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    await this.getConversationById(msg.conversation_id, user);
    return msg;
  }

  async createConversation(otherUserId: string, user: User): Promise<ChatConversation> {
    let conv = await this.conversationRepository.findOne({
      where: [
        { user_one_id: user.id, user_two_id: otherUserId },
        { user_one_id: otherUserId, user_two_id: user.id },
      ],
    });
    if (!conv) {
      conv = this.conversationRepository.create({
        user_one_id: user.id,
        user_two_id: otherUserId,
      });
      conv = await this.conversationRepository.save(conv);
    }
    return conv;
  }

  async sendMessage(
    conversationId: string,
    message: string | null,
    messageType: MessageType,
    mediaFileId: string | null,
    user: User,
  ): Promise<ChatMessage> {
    await this.getConversationById(conversationId, user);
    const msg = this.messageRepository.create({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: messageType || MessageType.TEXT,
      message: message || null,
      media_file_id: mediaFileId || null,
    });
    const saved = await this.messageRepository.save(msg);
    await this.conversationRepository.update(conversationId, { last_message_at: new Date() });
    return saved;
  }
}
