import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, MeetingStatus, AttendeeStatus } from '../../common/enums';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingAttendee)
    private readonly attendeeRepository: Repository<MeetingAttendee>,
  ) {}

  async findAll(user: User): Promise<Meeting[]> {
    if (user.role === UserRole.ADMIN) {
      return this.meetingRepository.find({ order: { meeting_date: 'DESC' } });
    }
    const myAttendees = await this.attendeeRepository.find({
      where: { user_id: user.id },
    });
    const meetingIds = myAttendees.map((a) => a.meeting_id);

    return this.meetingRepository.find({
      where: [
        { created_by_id: user.id },
        ...(meetingIds.length > 0 ? [{ id: In(meetingIds) }] : []),
      ],
      order: { meeting_date: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Meeting> {
    const meeting = await this.meetingRepository.findOne({ where: { id } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (user.role !== UserRole.ADMIN && meeting.created_by_id !== user.id) {
      const attendee = await this.attendeeRepository.findOne({
        where: { meeting_id: id, user_id: user.id },
      });
      if (!attendee) {
        throw new ForbiddenException('No permission to view this meeting');
      }
    }
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

  async addAttendee(
    meetingId: string,
    targetUserId: string,
    user: User,
  ): Promise<MeetingAttendee> {
    const meeting = await this.findOne(meetingId, user);
    if (user.role !== UserRole.ADMIN && meeting.created_by_id !== user.id) {
      throw new ForbiddenException(
        'Only meeting creator or Admin can add attendees',
      );
    }
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
    }
    return attendee;
  }

  async getAttendees(
    meetingId: string,
    user: User,
  ): Promise<MeetingAttendee[]> {
    await this.findOne(meetingId, user);
    return this.attendeeRepository.find({
      where: { meeting_id: meetingId },
    });
  }

  async getAttendeeById(id: string, user: User): Promise<MeetingAttendee> {
    const attendee = await this.attendeeRepository.findOne({ where: { id } });
    if (!attendee) {
      throw new NotFoundException('Meeting attendee not found');
    }
    await this.findOne(attendee.meeting_id, user);
    return attendee;
  }
}
