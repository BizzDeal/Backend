import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { UserRole, MessageType, NotificationType } from '../../common/enums';

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepo: Record<string, jest.Mock>;
  let messageRepo: Record<string, jest.Mock>;
  let notificationsService: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-1',
    phone: '+1234567890',
    full_name: 'Test User',
    role: UserRole.MEMBER,
  } as unknown as User;

  const anyDate = expect.any(Date) as unknown as Date;

  beforeEach(async () => {
    const mockConversationRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockMessageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockNotificationsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatConversation),
          useValue: mockConversationRepo,
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: mockMessageRepo,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    conversationRepo = module.get(getRepositoryToken(ChatConversation));
    messageRepo = module.get(getRepositoryToken(ChatMessage));
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('online status tracking', () => {
    it('should track user online status correctly', () => {
      expect(service.isUserOnline('user-1')).toBe(false);
      service.setUserOnlineStatus('user-1', true);
      expect(service.isUserOnline('user-1')).toBe(true);
      service.setUserOnlineStatus('user-1', false);
      expect(service.isUserOnline('user-1')).toBe(false);
    });
  });

  describe('createConversation', () => {
    it('should return existing conversation if found', async () => {
      const existingConv = {
        id: 'conv-1',
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      } as unknown as ChatConversation;

      conversationRepo.findOne.mockResolvedValue(existingConv);

      const result = await service.createConversation('user-2', mockUser);
      expect(result).toEqual(existingConv);
      expect(conversationRepo.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if not found', async () => {
      conversationRepo.findOne.mockResolvedValue(null);
      const newConv = {
        id: 'conv-1',
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      } as unknown as ChatConversation;

      conversationRepo.create.mockReturnValue(newConv);
      conversationRepo.save.mockResolvedValue(newConv);

      const result = await service.createConversation('user-2', mockUser);
      expect(result).toEqual(newConv);
      expect(conversationRepo.create).toHaveBeenCalledWith({
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      });
      expect(conversationRepo.save).toHaveBeenCalledWith(newConv);
    });
  });

  describe('sendMessage', () => {
    it('should save message, update conversation, and send notification if recipient offline', async () => {
      const conv = {
        id: 'conv-1',
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      } as unknown as ChatConversation;

      const savedMsg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        message: 'Hello world',
        message_type: MessageType.TEXT,
      } as unknown as ChatMessage;

      conversationRepo.findOne.mockResolvedValue(conv);
      messageRepo.create.mockReturnValue(savedMsg);
      messageRepo.save.mockResolvedValue(savedMsg);
      conversationRepo.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const result = await service.sendMessage(
        'conv-1',
        'Hello world',
        MessageType.TEXT,
        null,
        mockUser,
      );

      expect(result).toEqual(savedMsg);
      expect(conversationRepo.update).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({ last_message_at: anyDate }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith({
        user_id: 'user-2',
        title: 'New message from Test User',
        message: 'Hello world',
        type: NotificationType.CHAT,
        data: {
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          sender_id: 'user-1',
        },
      });
    });

    it('should not send notification if recipient is online', async () => {
      const conv = {
        id: 'conv-1',
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      } as unknown as ChatConversation;

      const savedMsg = {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        message: 'Hello world',
        message_type: MessageType.TEXT,
      } as unknown as ChatMessage;

      service.setUserOnlineStatus('user-2', true);
      conversationRepo.findOne.mockResolvedValue(conv);
      messageRepo.create.mockReturnValue(savedMsg);
      messageRepo.save.mockResolvedValue(savedMsg);
      conversationRepo.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      await service.sendMessage(
        'conv-1',
        'Hello world',
        MessageType.TEXT,
        null,
        mockUser,
      );

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('markMessagesAsRead', () => {
    it('should update unread messages and return count and read_at timestamp', async () => {
      const conv = {
        id: 'conv-1',
        user_one_id: 'user-1',
        user_two_id: 'user-2',
      } as unknown as ChatConversation;

      conversationRepo.findOne.mockResolvedValue(conv);

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      messageRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.markMessagesAsRead('conv-1', mockUser);

      expect(result.updated_count).toBe(5);
      expect(result.read_at).toBeInstanceOf(Date);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        is_read: true,
        read_at: anyDate,
      });
    });
  });
});
