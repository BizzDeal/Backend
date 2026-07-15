import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, MessageType, NotificationType, UserStatus } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  private readonly onlineUsers = new Set<string>();

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  setUserOnlineStatus(userId: string, isOnline: boolean): void {
    if (isOnline) {
      this.onlineUsers.add(userId);
    } else {
      this.onlineUsers.delete(userId);
    }
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  async getContacts(user: User): Promise<User[]> {
    if (user.role === UserRole.ADMIN) {
      return this.userRepository.find({
        where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE },
        order: { full_name: 'ASC' },
      });
    } else if (user.role === UserRole.MEMBER) {
      const admins = await this.userRepository.find({
        where: { role: UserRole.ADMIN },
      });
      const members = await this.userRepository.find({
        where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE },
        order: { full_name: 'ASC' },
      });
      const filteredMembers = members.filter((m) => m.id !== user.id);
      return [...admins, ...filteredMembers];
    }
    return [];
  }

  async findConversations(
    user: User,
  ): Promise<(ChatConversation & { unread_count: number })[]> {
    let convs: ChatConversation[];
    if (user.role === UserRole.ADMIN) {
      convs = await this.conversationRepository.find({
        order: { updated_at: 'DESC' },
      });
    } else {
      convs = await this.conversationRepository.find({
        where: [{ user_one_id: user.id }, { user_two_id: user.id }],
        order: { updated_at: 'DESC' },
      });
    }

    if (convs.length === 0) {
      return [];
    }

    const convIds = convs.map((c) => c.id);
    const unreadCounts: unknown[] = await this.messageRepository
      .createQueryBuilder('msg')
      .select('msg.conversation_id', 'conversation_id')
      .addSelect('COUNT(msg.id)', 'count')
      .where('msg.conversation_id IN (:...convIds)', { convIds })
      .andWhere('msg.sender_id != :userId', { userId: user.id })
      .andWhere('msg.is_read = :isRead', { isRead: false })
      .groupBy('msg.conversation_id')
      .getRawMany();

    const countMap = new Map<string, number>();
    for (const raw of unreadCounts) {
      if (raw && typeof raw === 'object') {
        const item = raw as Record<string, unknown>;
        const convIdRaw = item.conversation_id;
        const countRaw = item.count;
        if (
          (typeof convIdRaw === 'string' || typeof convIdRaw === 'number') &&
          (typeof countRaw === 'string' || typeof countRaw === 'number')
        ) {
          const convId = String(convIdRaw);
          const countVal = parseInt(String(countRaw), 10) || 0;
          countMap.set(convId, countVal);
        }
      }
    }

    return convs.map((conv) =>
      Object.assign(conv, {
        unread_count: countMap.get(conv.id) || 0,
      }),
    );
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

  async findMessagesByConversationId(
    conversationId: string,
    user: User,
  ): Promise<ChatMessage[]> {
    await this.getConversationById(conversationId, user);
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      relations: { media_file: true },
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

  async createConversation(
    otherUserId: string,
    user: User,
  ): Promise<ChatConversation> {
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
    const conv = await this.getConversationById(conversationId, user);
    const msg = this.messageRepository.create({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: messageType || MessageType.TEXT,
      message: message || null,
      media_file_id: mediaFileId || null,
    });
    const saved = await this.messageRepository.save(msg);
    const completeMsg = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: { media_file: true },
    });

    await this.conversationRepository.update(conversationId, {
      last_message_at: new Date(),
    });

    const recipientId =
      conv.user_one_id === user.id ? conv.user_two_id : conv.user_one_id;
    if (!this.isUserOnline(recipientId)) {
      await this.notifyOfflineRecipient(
        recipientId,
        user,
        message,
        messageType || MessageType.TEXT,
        conversationId,
        saved.id,
      );
    }

    return completeMsg ?? saved;
  }

  async markMessagesAsRead(
    conversationId: string,
    user: User,
  ): Promise<{ updated_count: number; read_at: Date }> {
    await this.getConversationById(conversationId, user);
    const readAt = new Date();
    const result = await this.messageRepository
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ is_read: true, read_at: readAt })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId: user.id })
      .andWhere('is_read = :isRead', { isRead: false })
      .execute();

    return {
      updated_count: result.affected || 0,
      read_at: readAt,
    };
  }

  async editMessage(
    messageId: string,
    newText: string,
    user: User,
  ): Promise<ChatMessage> {
    const msg = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: { media_file: true },
    });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.sender_id !== user.id) {
      throw new ForbiddenException('Only the sender can edit this message');
    }
    if (msg.is_deleted) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    msg.message = newText;
    msg.is_edited = true;
    msg.edited_at = new Date();
    return this.messageRepository.save(msg);
  }

  async deleteMessage(messageId: string, user: User): Promise<ChatMessage> {
    const msg = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.sender_id !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the sender can delete this message');
    }
    msg.is_deleted = true;
    msg.message = null;
    msg.media_file_id = null;
    return this.messageRepository.save(msg);
  }

  private async notifyOfflineRecipient(
    recipientId: string,
    sender: User,
    message: string | null,
    messageType: MessageType,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    try {
      let preview = message || 'Sent a message';
      if (messageType === MessageType.IMAGE) preview = '📷 Sent a photo';
      else if (messageType === MessageType.VOICE)
        preview = '🎤 Sent a voice note';
      else if (messageType === MessageType.FILE) preview = '📎 Sent a file';

      await this.notificationsService.create({
        user_id: recipientId,
        title: `New message from ${sender.full_name || sender.phone}`,
        message: preview,
        type: NotificationType.CHAT,
        data: {
          conversation_id: conversationId,
          message_id: messageId,
          sender_id: sender.id,
        },
      });
    } catch {
      // Silently catch notification errors to avoid breaking message delivery
    }
  }
}
