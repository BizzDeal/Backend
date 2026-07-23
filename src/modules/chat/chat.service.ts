import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, ILike, Not } from 'typeorm';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, MessageType, NotificationType, ConversationType, UserStatus } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly onlineUsers = new Set<string>();
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatParticipant)
    private readonly participantRepository: Repository<ChatParticipant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultGroupExists();
  }

  private async ensureDefaultGroupExists() {
    let group = await this.conversationRepository.findOne({ where: { is_default_group: true } });
    if (!group) {
      this.logger.log('Creating default BizzDeal Community group...');
      group = this.conversationRepository.create({
        type: ConversationType.GROUP,
        name: 'BizzDeal Community',
        is_default_group: true,
      });
      await this.conversationRepository.save(group);
    }
  }

  async addUserToDefaultGroup(userId: string) {
    const group = await this.conversationRepository.findOne({ where: { is_default_group: true } });
    if (group) {
      const exists = await this.participantRepository.findOne({
        where: { conversation_id: group.id, user_id: userId },
      });
      if (!exists) {
        await this.participantRepository.save(
          this.participantRepository.create({
            conversation_id: group.id,
            user_id: userId,
          }),
        );
      }
    }
  }

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

  async getContacts(user: User, search?: string): Promise<User[]> {
    if (search) {
      return this.userRepository.find({
        where: [
          { profile: { full_name: ILike(`%${search}%`) }, status: UserStatus.ACTIVE, id: Not(user.id), role: In([UserRole.ADMIN, UserRole.MEMBER]) },
          { phone: ILike(`%${search}%`), status: UserStatus.ACTIVE, id: Not(user.id), role: In([UserRole.ADMIN, UserRole.MEMBER]) },
        ],
        relations: { profile: true },
        take: 20,
      });
    } else {
      return this.userRepository.find({
        where: { role: In([UserRole.ADMIN, UserRole.MEMBER]), status: UserStatus.ACTIVE, id: Not(user.id) },
        relations: { profile: true },
      });
    }
  }

  async findConversations(user: User): Promise<any[]> {
    // Also ensuring user is in the default group just in case
    await this.addUserToDefaultGroup(user.id);

    const participants = await this.participantRepository.find({
      where: { user_id: user.id },
      relations: {
        conversation: {
          participants: {
            user: { profile: true },
          },
        },
      },
      order: {
        conversation: {
          updated_at: 'DESC',
        },
      },
    });

    return participants.map((p) => {
      let partner: any = null;
      if (p.conversation.type === ConversationType.DIRECT) {
        const otherParticipant = p.conversation.participants.find(
          (cp) => cp.user_id !== user.id,
        );
        if (otherParticipant) {
          partner = {
            id: otherParticipant.user.id,
            full_name: otherParticipant.user.profile?.full_name || (otherParticipant.user.role === 'ADMIN' ? 'Admin' : 'Unknown User'),
            phone: otherParticipant.user.phone,
            role: otherParticipant.user.role,
            profile_pic_url: otherParticipant.user.profile?.profile_pic_url || null,
            isOnline: this.isUserOnline(otherParticipant.user.id),
          };
        }
      }

      return {
        id: p.conversation.id,
        type: p.conversation.type,
        name: p.conversation.name,
        is_default_group: p.conversation.is_default_group,
        last_message_at: p.conversation.last_message_at,
        created_at: p.conversation.created_at,
        updated_at: p.conversation.updated_at,
        unread_count: p.unread_count,
        partner,
      };
    });
  }

  async getConversationById(id: string, user: User): Promise<ChatConversation> {
    const conv = await this.conversationRepository.findOne({
      where: { id },
      relations: { participants: true }, // Keep relations for other usages that might expect it
    });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    
    const participantCount = await this.participantRepository.count({
      where: { conversation_id: id, user_id: user.id }
    });
    
    if (participantCount === 0 && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission to view this conversation');
    }
    return conv;
  }

  async findMessagesByConversationId(
    conversationId: string,
    user: User,
    page: number = 1,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    await this.getConversationById(conversationId, user);
    
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'DESC' }, // Reverse order for pagination (latest first)
      skip: (page - 1) * limit,
      take: limit,
      relations: { media_file: true },
    }).then(msgs => msgs.reverse()); // Reverse again to return oldest -> newest for the UI
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
  ): Promise<any> {
    if (user.id === otherUserId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    // Find existing DIRECT conversation between these two
    const existing = await this.conversationRepository.createQueryBuilder('conv')
      .innerJoin('conv.participants', 'p1', 'p1.user_id = :userId', { userId: user.id })
      .innerJoin('conv.participants', 'p2', 'p2.user_id = :otherId', { otherId: otherUserId })
      .where('conv.type = :type', { type: ConversationType.DIRECT })
      .getOne();

    if (existing) {
      return existing;
    }

    // Create new
    const conv = this.conversationRepository.create({
      type: ConversationType.DIRECT,
    });
    const savedConv = await this.conversationRepository.save(conv);

    await this.participantRepository.save([
      this.participantRepository.create({ conversation_id: savedConv.id, user_id: user.id }),
      this.participantRepository.create({ conversation_id: savedConv.id, user_id: otherUserId }),
    ]);

    return savedConv;
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

    // Update unread count for other participants
    await this.participantRepository
      .createQueryBuilder()
      .update(ChatParticipant)
      .set({ unread_count: () => 'unread_count + 1' })
      .where('conversation_id = :convId', { convId: conversationId })
      .andWhere('user_id != :userId', { userId: user.id })
      .execute();

    // Send push notifications to offline users
    const offlineParticipants = conv.participants.filter(p => p.user_id !== user.id && !this.isUserOnline(p.user_id));
    for (const p of offlineParticipants) {
      await this.notifyOfflineRecipient(
        p.user_id,
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
    const readAt = new Date();
    await this.participantRepository.update(
      { conversation_id: conversationId, user_id: user.id },
      { unread_count: 0, last_read_at: readAt }
    );

    return {
      updated_count: 1, // We don't have individual message read statuses anymore
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
        title: `New message from ${sender.profile?.full_name || sender.phone}`,
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
