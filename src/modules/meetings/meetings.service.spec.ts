import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import {
  UserRole,
  MeetingStatus,
  AttendeeStatus,
  NotificationType,
} from '../../common/enums';

describe('MeetingsService', () => {
  let service: MeetingsService;
  let meetingRepo: Record<string, jest.Mock>;
  let attendeeRepo: Record<string, jest.Mock>;
  let notificationsService: Record<string, jest.Mock>;

  const adminUser = {
    id: 'admin-1',
    role: UserRole.ADMIN,
  } as unknown as User;

  const memberUser = {
    id: 'member-1',
    role: UserRole.MEMBER,
  } as unknown as User;

  const customerUser = {
    id: 'customer-1',
    role: UserRole.CUSTOMER,
  } as unknown as User;

  beforeEach(async () => {
    meetingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    attendeeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    notificationsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        {
          provide: getRepositoryToken(Meeting),
          useValue: meetingRepo,
        },
        {
          provide: getRepositoryToken(MeetingAttendee),
          useValue: attendeeRepo,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('RBAC & Permission Checks', () => {
    it('should block Customers from calling findAll', async () => {
      await expect(service.findAll({}, customerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should block Customers from calling findOne', async () => {
      await expect(service.findOne('meeting-1', customerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should block Members from creating a meeting', async () => {
      await expect(
        service.create(
          { title: 'Test Meeting', meeting_date: new Date() },
          memberUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should block Members from deleting a meeting', async () => {
      await expect(service.remove('meeting-1', memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should block Members from removing an attendee', async () => {
      await expect(
        service.removeAttendee('meeting-1', 'att-1', memberUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create (Admin Only)', () => {
    it('should allow Admin to create a meeting and assign admin as accepted attendee', async () => {
      const dto = {
        title: 'Strategy Meeting',
        meeting_date: '2026-08-15T10:00:00Z',
      };
      const createdMeeting = { id: 'meeting-1', ...dto };
      meetingRepo.create.mockReturnValue(createdMeeting);
      meetingRepo.save.mockResolvedValue(createdMeeting);
      attendeeRepo.create.mockReturnValue({
        meeting_id: 'meeting-1',
        user_id: adminUser.id,
        status: AttendeeStatus.ACCEPTED,
      });
      attendeeRepo.save.mockResolvedValue({ id: 'att-1' });

      const result = await service.create(dto, adminUser);

      expect(meetingRepo.create).toHaveBeenCalled();
      expect(meetingRepo.save).toHaveBeenCalledWith(createdMeeting);
      expect(attendeeRepo.save).toHaveBeenCalled();
      expect(result).toEqual(createdMeeting);
    });
  });

  describe('update & Notifications', () => {
    it('should send notifications to attendees when meeting is cancelled', async () => {
      const existingMeeting = {
        id: 'meeting-1',
        title: 'Strategy Meeting',
        status: MeetingStatus.SCHEDULED,
      };
      meetingRepo.findOne.mockResolvedValue(existingMeeting);
      meetingRepo.save.mockImplementation((m) => Promise.resolve(m));

      attendeeRepo.find.mockResolvedValue([
        { user_id: adminUser.id },
        { user_id: memberUser.id },
      ]);

      await service.update(
        'meeting-1',
        { status: MeetingStatus.CANCELLED },
        adminUser,
      );

      expect(notificationsService.create).toHaveBeenCalledWith({
        user_id: memberUser.id,
        title: 'Meeting Cancelled',
        message: 'Meeting "Strategy Meeting" has been cancelled.',
        type: NotificationType.MEETING,
        data: { meeting_id: 'meeting-1' },
      });
    });
  });

  describe('updateAttendeeStatus (RSVP & Attendance Tracking)', () => {
    it('should allow Member to accept invitation (RSVP)', async () => {
      const existingMeeting = { id: 'meeting-1', created_by_id: 'admin-1' };
      const existingAttendee = {
        id: 'att-1',
        meeting_id: 'meeting-1',
        user_id: memberUser.id,
        status: AttendeeStatus.INVITED,
      };
      meetingRepo.findOne.mockResolvedValue(existingMeeting);
      attendeeRepo.findOne.mockImplementation(({ where }) => {
        if (where.id === 'att-1') return Promise.resolve(existingAttendee);
        if (where.meeting_id === 'meeting-1' && where.user_id === memberUser.id)
          return Promise.resolve(existingAttendee);
        return Promise.resolve(null);
      });
      attendeeRepo.save.mockImplementation((a) => Promise.resolve(a));

      const result = await service.updateAttendeeStatus(
        'meeting-1',
        'att-1',
        AttendeeStatus.ACCEPTED,
        memberUser,
      );

      expect(result.status).toBe(AttendeeStatus.ACCEPTED);
    });

    it('should forbid Member from marking themselves as ATTENDED', async () => {
      const existingMeeting = { id: 'meeting-1', created_by_id: 'admin-1' };
      const existingAttendee = {
        id: 'att-1',
        meeting_id: 'meeting-1',
        user_id: memberUser.id,
        status: AttendeeStatus.INVITED,
      };
      meetingRepo.findOne.mockResolvedValue(existingMeeting);
      attendeeRepo.findOne.mockImplementation(({ where }) => {
        if (where.id === 'att-1') return Promise.resolve(existingAttendee);
        if (where.meeting_id === 'meeting-1' && where.user_id === memberUser.id)
          return Promise.resolve(existingAttendee);
        return Promise.resolve(null);
      });

      await expect(
        service.updateAttendeeStatus(
          'meeting-1',
          'att-1',
          AttendeeStatus.ATTENDED,
          memberUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to mark attendee as ATTENDED and set attended_at timestamp', async () => {
      const existingMeeting = { id: 'meeting-1', created_by_id: 'admin-1' };
      const existingAttendee = {
        id: 'att-1',
        meeting_id: 'meeting-1',
        user_id: memberUser.id,
        status: AttendeeStatus.ACCEPTED,
        attended_at: null,
      };
      meetingRepo.findOne.mockResolvedValue(existingMeeting);
      attendeeRepo.findOne.mockResolvedValue(existingAttendee);
      attendeeRepo.save.mockImplementation((a) => Promise.resolve(a));

      const result = await service.updateAttendeeStatus(
        'meeting-1',
        'att-1',
        AttendeeStatus.ATTENDED,
        adminUser,
      );

      expect(result.status).toBe(AttendeeStatus.ATTENDED);
      expect(result.attended_at).toBeDefined();
    });
  });
});
