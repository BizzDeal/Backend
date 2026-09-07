import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { UserRole, MessageType, NotificationType, UserStatus } from '../../common/enums';

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepo: Record<string, jest.Mock>;
  let messageRepo: Record<string, jest.Mock>;
  let participantRepo: Record<string, jest.Mock>;
  let notificationsService: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-1',
    phone: '+1234567890',
    full_name: 'Test User',
    profile: { full_name: 'Test User' },
    role: UserRole.MEMBER,
  } as unknown as User;

  const anyDate = expect.any(Date) as unknown as Date;

  beforeEach(async () => {
    const convQbMock = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const mockConversationRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => Promise.resolve(dto)),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(convQbMock),
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

    const mockParticipantRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => Promise.resolve(dto)),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    };

    const mockUserRepo = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ id: 'user-2', status: UserStatus.ACTIVE, role: UserRole.MEMBER }),
    };

    const mockMediaFileRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
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
          provide: getRepositoryToken(ChatParticipant),
          useValue: mockParticipantRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(MediaFile),
          useValue: mockMediaFileRepo,
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
    participantRepo = module.get(getRepositoryToken(ChatParticipant));
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
        type: 'DIRECT',
      } as unknown as ChatConversation;

      (conversationRepo.createQueryBuilder().getOne as jest.Mock).mockResolvedValue(existingConv);

      const result = await service.createConversation('user-2', mockUser);
      expect(result).toEqual(expect.objectContaining({ id: 'conv-1', type: 'DIRECT' }));
      expect(conversationRepo.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if not found', async () => {
      (conversationRepo.createQueryBuilder().getOne as jest.Mock).mockResolvedValue(null);
      const newConv = {
        id: 'conv-1',
        type: 'DIRECT',
      } as unknown as ChatConversation;

      conversationRepo.create.mockReturnValue(newConv);
      conversationRepo.save.mockResolvedValue(newConv);

      const result = await service.createConversation('user-2', mockUser);
      expect(result).toEqual(expect.objectContaining({ id: 'conv-1', type: 'DIRECT' }));
      expect(conversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DIRECT' }),
      );
      expect(conversationRepo.save).toHaveBeenCalledWith(newConv);
    });
  });

  describe('sendMessage', () => {
    it('should save message, update conversation, and send notification if recipient offline', async () => {
      const conv = {
        id: 'conv-1',
        participants: [
          { user_id: 'user-1' },
          { user_id: 'user-2' },
        ],
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
        participants: [
          { user_id: 'user-1' },
          { user_id: 'user-2' },
        ],
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
      const result = await service.markMessagesAsRead('conv-1', mockUser);

      expect(result.updated_count).toBe(1);
      expect(result.read_at).toBeInstanceOf(Date);
      expect(participantRepo.update).toHaveBeenCalledWith(
        { conversation_id: 'conv-1', user_id: 'user-1' },
        { unread_count: 0, last_read_at: expect.any(Date) },
      );
    });
  });

  describe('addUserToDefaultGroup', () => {
    it('should NOT add customer users to the default community group', async () => {
      const customerUser = { id: 'cust-1', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE };
      (service['userRepository'].findOne as jest.Mock).mockResolvedValue(customerUser);

      await service.addUserToDefaultGroup('cust-1');

      expect(service['conversationRepository'].findOne).not.toHaveBeenCalled();
      expect(service['participantRepository'].save).not.toHaveBeenCalled();
    });

    it('should add active members to the default community group', async () => {
      const memberUser = { id: 'mem-1', role: UserRole.MEMBER, status: UserStatus.ACTIVE };
      const groupConv = { id: 'group-1', is_default_group: true };
      (service['userRepository'].findOne as jest.Mock).mockResolvedValue(memberUser);
      (service['conversationRepository'].findOne as jest.Mock).mockResolvedValue(groupConv);
      (service['participantRepository'].findOne as jest.Mock).mockResolvedValue(null);

      await service.addUserToDefaultGroup('mem-1');

      expect(service['participantRepository'].save).toHaveBeenCalledWith(
        expect.objectContaining({ conversation_id: 'group-1', user_id: 'mem-1' }),
      );
    });
  });
});
