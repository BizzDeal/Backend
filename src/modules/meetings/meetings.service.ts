import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { User } from '../users/entities/user.entity';
import {
  UserRole,
  MeetingStatus,
  MeetingType,
  AttendeeStatus,
  NotificationType,
  MediaPurpose,
} from '../../common/enums';
import { MediaFile } from '../media/entities/media-file.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MeetingQueryDto } from './dto/meetings.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingAttendee)
    private readonly attendeeRepository: Repository<MeetingAttendee>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
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
    qb.leftJoin('meeting.business', 'business');
    qb.leftJoin('business.owner', 'owner');
    qb.leftJoin('owner.profile', 'profile');

    if (user.role === UserRole.MEMBER) {
      const fullUser = await this.userRepository.findOne({
        where: { id: user.id },
        relations: { business_profile: true },
      });
      const myDistrictId = fullUser?.business_profile?.district_id;
      
      if (myDistrictId) {
        qb.andWhere('(meeting.meeting_type = :regular OR (meeting.meeting_type = :spotlight AND business.district_id = :districtId))', {
          regular: MeetingType.REGULAR,
          spotlight: MeetingType.SPOTLIGHT,
          districtId: myDistrictId
        });
      } else {
        qb.andWhere('meeting.meeting_type = :regular', { regular: MeetingType.REGULAR });
      }
    }

    if (query.status) {
      qb.andWhere('meeting.status = :status', { status: query.status });
    }
    if (query.meeting_type) {
      qb.andWhere('meeting.meeting_type = :mType', { mType: query.meeting_type });
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

    if (query.state) {
      qb.andWhere('(business.state_id = :state OR profile.state_id = :state)', {
        state: query.state,
      });
    }
    
    if (query.district) {
      qb.andWhere('(business.district_id = :district OR profile.district_id = :district)', {
        district: query.district,
      });
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
      meeting_type?: MeetingType;
    },
    user: User,
  ): Promise<Meeting> {
    this.checkNotCustomer(user);

    let meetingType = data.meeting_type || MeetingType.REGULAR;
    let businessId = data.business_id || null;

    if (user.role === UserRole.MEMBER) {
      meetingType = MeetingType.SPOTLIGHT;
      const fullUser = await this.userRepository.findOne({
        where: { id: user.id },
        relations: { business_profile: true },
      });
      if (!fullUser?.business_profile) {
        throw new BadRequestException('You must have a business profile to create a spotlight meeting');
      }
      businessId = fullUser.business_profile.id;
    } else {
      this.checkAdminRole(user);
    }

    const meeting = this.meetingRepository.create({
      created_by_id: user.id,
      business_id: businessId,
      meeting_type: meetingType,
      title: data.title,
      description: data.description || null,
      meeting_date: new Date(data.meeting_date),
      location: data.location || null,
      meeting_link: data.meeting_link || null,
      status: MeetingStatus.SCHEDULED,
    });
    const saved = await this.meetingRepository.save(meeting);

    if (meetingType === MeetingType.SPOTLIGHT && businessId) {
      const fullUser = await this.userRepository.findOne({
        where: { id: user.id },
        relations: { business_profile: true },
      });
      const districtId = fullUser?.business_profile?.district_id;
      if (districtId) {
        const peers = await this.userRepository.find({
          where: {
            role: UserRole.MEMBER,
            business_profile: { district_id: districtId },
          },
        });

        for (const peer of peers) {
          if (peer.id !== user.id) {
            await this.notificationsService.create({
              user_id: peer.id,
              title: 'New Spotlight Meeting',
              message: `A new spotlight meeting "${saved.title}" was created in your district.`,
              type: NotificationType.MEETING,
              data: { meeting_id: saved.id },
            });
          }
        }
      }
    }

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
    this.checkNotCustomer(user);
    const meeting = await this.findOne(id, user);

    if (user.role === UserRole.ADMIN) {
      if (meeting.meeting_type === MeetingType.SPOTLIGHT) {
        throw new ForbiddenException('Admins cannot modify spotlight meetings');
      }
    } else if (user.role === UserRole.MEMBER) {
      if (meeting.created_by_id !== user.id) {
        throw new ForbiddenException('You can only edit your own meetings');
      }
    }

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

          const targetUser = await this.userRepository.findOne({ where: { id: attendee.user_id } });
          if (targetUser) {
            await this.mailService.sendMeetingEmail(
              targetUser.email,
              'CANCELED',
              saved.title,
              saved.meeting_date.toLocaleDateString(),
              saved.meeting_date.toLocaleTimeString()
            );
          }
        }
      }
    } else if (
      oldStatus !== saved.status || 
      data.meeting_date !== undefined || 
      data.location !== undefined || 
      data.meeting_link !== undefined
    ) {
      const attendees = await this.attendeeRepository.find({
        where: { meeting_id: saved.id },
      });
      for (const attendee of attendees) {
        if (attendee.user_id !== user.id) {
          await this.notificationsService.create({
            user_id: attendee.user_id,
            title: 'Meeting Updated',
            message: `Meeting "${saved.title}" has been updated.`,
            type: NotificationType.MEETING,
            data: { meeting_id: saved.id },
          });

          const targetUser = await this.userRepository.findOne({ where: { id: attendee.user_id } });
          if (targetUser) {
            await this.mailService.sendMeetingEmail(
              targetUser.email,
              'UPDATED',
              saved.title,
              saved.meeting_date.toLocaleDateString(),
              saved.meeting_date.toLocaleTimeString()
            );
          }
        }
      }
    }

    return saved;
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    this.checkNotCustomer(user);
    const meeting = await this.findOne(id, user);

    if (user.role === UserRole.ADMIN) {
      if (meeting.meeting_type === MeetingType.SPOTLIGHT) {
        throw new ForbiddenException('Admins cannot delete spotlight meetings');
      }
    } else if (user.role === UserRole.MEMBER) {
      if (meeting.created_by_id !== user.id) {
        throw new ForbiddenException('You can only delete your own meetings');
      }
    }

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

        const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });
        if (targetUser) {
          await this.mailService.sendMeetingEmail(
            targetUser.email,
            'CREATED',
            meeting.title,
            meeting.meeting_date.toLocaleDateString(),
            meeting.meeting_date.toLocaleTimeString()
          );
        }
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
    this.checkNotCustomer(user);
    const meeting = await this.findOne(meetingId, user);

    if (user.role === UserRole.MEMBER && meeting.created_by_id !== user.id) {
      throw new ForbiddenException('Only the host can view the attendee report');
    }

    const whereCondition: any = { role: UserRole.MEMBER };
    // Assuming members are global or business filtering is done differently. 
    // The User entity does not have a business_id.

    const members = await this.userRepository.find({
      where: whereCondition,
      relations: { profile: true, business_profile: true },
      select: {
        id: true,
        phone: true,
        profile: {
          full_name: true,
        },
        business_profile: {
          name: true,
        },
      },
    });

    const attendees = await this.attendeeRepository.find({
      where: { meeting_id: meetingId },
    });

    const userIds = members.map(m => m.id);
    let profilePicMap = new Map<string, string>();
    if (userIds.length > 0) {
      const profilePics = await this.mediaRepository.find({
        where: {
          uploaded_by_id: In(userIds),
          purpose: MediaPurpose.PROFILE_PIC,
        },
      });
      profilePics.forEach((pic) => {
        if (pic.uploaded_by_id) {
          profilePicMap.set(pic.uploaded_by_id, pic.file_url);
        }
      });
    }

    return members.map((member) => {
      const record = attendees.find((a) => a.user_id === member.id);
      return {
        id: member.id,
        full_name: member.profile?.full_name || null,
        phone: member.phone,
        profile_pic: profilePicMap.get(member.id) || null,
        business_name: member.business_profile?.name || null,
        status: record ? record.status : 'PENDING',
      };
    });
  }
}
