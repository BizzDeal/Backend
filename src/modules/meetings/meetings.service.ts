import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { User } from '../users/entities/user.entity';
import {
  UserRole,
  MeetingStatus,
  AttendeeStatus,
  NotificationType,
} from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { MeetingQueryDto } from './dto/meetings.dto';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingAttendee)
    private readonly attendeeRepository: Repository<MeetingAttendee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private checkNotCustomer(user: User): void {
    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot access meetings');
    }
  }

  private checkAdminRole(user: User): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only Admin can perform this action');
    }
  }

  async findAll(query: MeetingQueryDto, user: User): Promise<Meeting[]> {
    this.checkNotCustomer(user);

    const qb = this.meetingRepository.createQueryBuilder('meeting');

    // Visibility is now global for members. They can see all meetings.

    if (query.status) {
      qb.andWhere('meeting.status = :status', { status: query.status });
    }
    if (query.business_id) {
      qb.andWhere('meeting.business_id = :businessId', {
        businessId: query.business_id,
      });
    }
    if (query.from_date) {
      qb.andWhere('meeting.meeting_date >= :fromDate', {
        fromDate: new Date(query.from_date),
      });
    }
    if (query.to_date) {
      qb.andWhere('meeting.meeting_date <= :toDate', {
        toDate: new Date(query.to_date),
      });
    }

    if (query.states || query.districts) {
      qb.leftJoin('meeting.business', 'business');
      qb.leftJoin('business.owner', 'owner');
      
      if (query.states) {
        qb.andWhere('owner.state_id IN (:...states)', {
          states: query.states.split(','),
        });
      }
      if (query.districts) {
        qb.andWhere('owner.district_id IN (:...districts)', {
          districts: query.districts.split(','),
        });
      }
    }

    qb.orderBy('meeting.meeting_date', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Meeting> {
    this.checkNotCustomer(user);

    const meeting = await this.meetingRepository.findOne({ where: { id } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    // Any member can view the meeting details now.

    return meeting;
  }

  async create(
    data: {
      title: string;
      description?: string;
      meeting_date: string | Date;
      location?: string;
      meeting_link?: string;
      business_id?: string;
    },
    user: User,
  ): Promise<Meeting> {
    this.checkAdminRole(user);

    const meeting = this.meetingRepository.create({
      created_by_id: user.id,
      business_id: data.business_id || null,
      title: data.title,
      description: data.description || null,
      meeting_date: new Date(data.meeting_date),
      location: data.location || null,
      meeting_link: data.meeting_link || null,
      status: MeetingStatus.SCHEDULED,
    });
    const saved = await this.meetingRepository.save(meeting);

    await this.attendeeRepository.save(
      this.attendeeRepository.create({
        meeting_id: saved.id,
        user_id: user.id,
        status: AttendeeStatus.ACCEPTED,
      }),
    );

    return saved;
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      meeting_date?: string | Date;
      location?: string;
      meeting_link?: string;
      status?: MeetingStatus;
    },
    user: User,
  ): Promise<Meeting> {
    this.checkAdminRole(user);
    const meeting = await this.findOne(id, user);

    const oldStatus = meeting.status;

    if (data.title !== undefined) meeting.title = data.title;
    if (data.description !== undefined)
      meeting.description = data.description || null;
    if (data.meeting_date !== undefined)
      meeting.meeting_date = new Date(data.meeting_date);
    if (data.location !== undefined) meeting.location = data.location || null;
    if (data.meeting_link !== undefined)
      meeting.meeting_link = data.meeting_link || null;
    if (data.status !== undefined) meeting.status = data.status;

    const saved = await this.meetingRepository.save(meeting);

    if (
      saved.status === MeetingStatus.CANCELLED &&
      oldStatus !== MeetingStatus.CANCELLED
    ) {
      const attendees = await this.attendeeRepository.find({
        where: { meeting_id: saved.id },
      });
      for (const attendee of attendees) {
        if (attendee.user_id !== user.id) {
          await this.notificationsService.create({
            user_id: attendee.user_id,
            title: 'Meeting Cancelled',
            message: `Meeting "${saved.title}" has been cancelled.`,
            type: NotificationType.MEETING,
            data: { meeting_id: saved.id },
          });
        }
      }
    }

    return saved;
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    this.checkAdminRole(user);
    const meeting = await this.findOne(id, user);

    await this.meetingRepository.remove(meeting);
    return { message: 'Meeting deleted successfully' };
  }

  async addAttendee(
    meetingId: string,
    targetUserId: string,
    user: User,
  ): Promise<MeetingAttendee> {
    this.checkAdminRole(user);
    const meeting = await this.findOne(meetingId, user);

    let attendee = await this.attendeeRepository.findOne({
      where: { meeting_id: meetingId, user_id: targetUserId },
    });

    if (!attendee) {
      attendee = this.attendeeRepository.create({
        meeting_id: meetingId,
        user_id: targetUserId,
        status: AttendeeStatus.INVITED,
      });
      attendee = await this.attendeeRepository.save(attendee);

      if (targetUserId !== user.id) {
        await this.notificationsService.create({
          user_id: targetUserId,
          title: 'Meeting Invitation',
          message: `You have been invited to meeting "${meeting.title}".`,
          type: NotificationType.MEETING,
          data: { meeting_id: meeting.id, attendee_id: attendee.id },
        });
      }
    }

    return attendee;
  }

  async updateAttendeeStatus(
    meetingId: string,
    attendeeId: string,
    status: AttendeeStatus,
    user: User,
  ): Promise<MeetingAttendee> {
    this.checkNotCustomer(user);
    await this.findOne(meetingId, user);

    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
    });
    if (!attendee) {
      throw new NotFoundException('Meeting attendee not found');
    }
    if (attendee.meeting_id !== meetingId) {
      throw new BadRequestException('Attendee does not belong to this meeting');
    }

    if (user.role === UserRole.ADMIN) {
      attendee.status = status;
      if (status === AttendeeStatus.ATTENDED) {
        attendee.attended_at = new Date();
      } else {
        attendee.attended_at = null;
      }
    } else {
      if (attendee.user_id !== user.id) {
        throw new ForbiddenException(
          'You can only update your own attendance status',
        );
      }
      if (
        status !== AttendeeStatus.ACCEPTED &&
        status !== AttendeeStatus.REJECTED
      ) {
        throw new ForbiddenException(
          'Members can only RSVP as ACCEPTED or REJECTED',
        );
      }
      attendee.status = status;
    }

    return this.attendeeRepository.save(attendee);
  }

  async rsvpMeeting(
    meetingId: string,
    status: AttendeeStatus,
    user: User,
  ): Promise<MeetingAttendee> {
    this.checkNotCustomer(user);
    await this.findOne(meetingId, user);

    if (
      status !== AttendeeStatus.ACCEPTED &&
      status !== AttendeeStatus.REJECTED
    ) {
      throw new ForbiddenException(
        'Members can only RSVP as ACCEPTED or REJECTED',
      );
    }

    let attendee = await this.attendeeRepository.findOne({
      where: { meeting_id: meetingId, user_id: user.id },
    });

    if (attendee) {
      attendee.status = status;
    } else {
      attendee = this.attendeeRepository.create({
        meeting_id: meetingId,
        user_id: user.id,
        status,
      });
    }

    return this.attendeeRepository.save(attendee);
  }

  async removeAttendee(
    meetingId: string,
    attendeeId: string,
    user: User,
  ): Promise<{ message: string }> {
    this.checkAdminRole(user);
    await this.findOne(meetingId, user);

    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
    });
    if (!attendee) {
      throw new NotFoundException('Meeting attendee not found');
    }
    if (attendee.meeting_id !== meetingId) {
      throw new BadRequestException('Attendee does not belong to this meeting');
    }

    await this.attendeeRepository.remove(attendee);
    return { message: 'Attendee removed successfully' };
  }

  async getAttendees(
    meetingId: string,
    user: User,
  ): Promise<MeetingAttendee[]> {
    this.checkNotCustomer(user);
    await this.findOne(meetingId, user);

    return this.attendeeRepository.find({
      where: { meeting_id: meetingId },
    });
  }

  async getAttendeeById(id: string, user: User): Promise<MeetingAttendee> {
    this.checkNotCustomer(user);

    const attendee = await this.attendeeRepository.findOne({ where: { id } });
    if (!attendee) {
      throw new NotFoundException('Meeting attendee not found');
    }

    await this.findOne(attendee.meeting_id, user);
    return attendee;
  }

  async getMeetingAttendeeReport(meetingId: string, user: User) {
    this.checkAdminRole(user);
    const meeting = await this.findOne(meetingId, user);

    const whereCondition: any = { role: UserRole.MEMBER };
    // Assuming members are global or business filtering is done differently. 
    // The User entity does not have a business_id.

    const members = await this.userRepository.find({
      where: whereCondition,
      relations: { profile: true },
      select: {
        id: true,
        phone: true,
        profile: {
          full_name: true,
        },
      },
    });

    const attendees = await this.attendeeRepository.find({
      where: { meeting_id: meetingId },
    });

    return members.map((member) => {
      const record = attendees.find((a) => a.user_id === member.id);
      return {
        id: member.id,
        full_name: member.profile?.full_name || null,
        phone: member.phone,
        status: record ? record.status : 'PENDING',
      };
    });
  }
}
