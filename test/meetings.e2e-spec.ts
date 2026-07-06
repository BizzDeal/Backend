import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './../src/app.module';
import {
  UserRole,
  UserStatus,
  MeetingStatus,
  AttendeeStatus,
} from './../src/common/enums';
import { User } from './../src/modules/users/entities/user.entity';
import { Meeting } from './../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from './../src/modules/meetings/entities/meeting-attendee.entity';

describe('MeetingsController (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let meetingRepository: Repository<Meeting>;
  let attendeeRepository: Repository<MeetingAttendee>;
  let jwtService: JwtService;

  let adminUser: User;
  let memberUser: User;
  let customerUser: User;

  let adminToken: string;
  let memberToken: string;
  let customerToken: string;

  let testMeetingId: string;
  let testAttendeeId: string;

  const testPhones = ['9777000001', '9777000002', '9777000003'];

  async function cleanup() {
    if (!userRepository) return;
    for (const phone of testPhones) {
      const user = await userRepository.findOne({ where: { phone } });
      if (user) {
        await userRepository.delete({ id: user.id });
      }
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    meetingRepository = moduleFixture.get<Repository<Meeting>>(
      getRepositoryToken(Meeting),
    );
    attendeeRepository = moduleFixture.get<Repository<MeetingAttendee>>(
      getRepositoryToken(MeetingAttendee),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await cleanup();

    adminUser = await userRepository.save(
      userRepository.create({
        full_name: 'E2E Admin User',
        phone: '9777000001',
        pin_hash: 'hashedpin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    );

    memberUser = await userRepository.save(
      userRepository.create({
        full_name: 'E2E Member User',
        phone: '9777000002',
        pin_hash: 'hashedpin',
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
      }),
    );

    customerUser = await userRepository.save(
      userRepository.create({
        full_name: 'E2E Customer User',
        phone: '9777000003',
        pin_hash: 'hashedpin',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      }),
    );

    const secret = process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret';
    adminToken = await jwtService.signAsync(
      { sub: adminUser.id, phone: adminUser.phone, role: adminUser.role },
      { secret },
    );
    memberToken = await jwtService.signAsync(
      { sub: memberUser.id, phone: memberUser.phone, role: memberUser.role },
      { secret },
    );
    customerToken = await jwtService.signAsync(
      {
        sub: customerUser.id,
        phone: customerUser.phone,
        role: customerUser.role,
      },
      { secret },
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('POST /meetings (Create Meeting)', () => {
    it('should return 403 when Member attempts to create a meeting', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Test E2E Meeting',
          meeting_date: '2026-08-15T10:00:00Z',
        })
        .expect(403);
    });

    it('should return 403 when Customer attempts to create a meeting', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Test E2E Meeting',
          meeting_date: '2026-08-15T10:00:00Z',
        })
        .expect(403);
    });

    it('should return 201 when Admin creates a meeting', async () => {
      const res = await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test E2E Meeting',
          description: 'Discussing Q3 targets',
          meeting_date: '2026-08-15T10:00:00Z',
          location: 'Conference Room A',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Test E2E Meeting');
      testMeetingId = res.body.id;
    });
  });

  describe('GET /meetings (List Meetings)', () => {
    it('should return 403 when Customer attempts to list meetings', async () => {
      await request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should return 200 when Admin lists meetings', async () => {
      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((m: any) => m.id === testMeetingId)).toBe(true);
    });
  });

  describe('POST /meetings/:id/attendees (Invite Attendee)', () => {
    it('should return 403 when Member attempts to invite an attendee', async () => {
      await request(app.getHttpServer())
        .post(`/meetings/${testMeetingId}/attendees`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ user_id: memberUser.id })
        .expect(403);
    });

    it('should return 201 when Admin invites Member to meeting', async () => {
      const res = await request(app.getHttpServer())
        .post(`/meetings/${testMeetingId}/attendees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: memberUser.id })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.user_id).toBe(memberUser.id);
      expect(res.body.status).toBe(AttendeeStatus.INVITED);
      testAttendeeId = res.body.id;
    });
  });

  describe('PUT /meetings/attendees/:attendeeId (RSVP & Attendance Tracking)', () => {
    it('should return 200 when Member accepts invitation (RSVP)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/meetings/attendees/${testAttendeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: AttendeeStatus.ACCEPTED })
        .expect(200);

      expect(res.body.status).toBe(AttendeeStatus.ACCEPTED);
    });

    it('should return 403 when Member attempts to mark themselves as ATTENDED', async () => {
      await request(app.getHttpServer())
        .put(`/meetings/attendees/${testAttendeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: AttendeeStatus.ATTENDED })
        .expect(403);
    });

    it('should return 200 when Admin marks attendee as ATTENDED', async () => {
      const res = await request(app.getHttpServer())
        .put(`/meetings/attendees/${testAttendeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: AttendeeStatus.ATTENDED })
        .expect(200);

      expect(res.body.status).toBe(AttendeeStatus.ATTENDED);
      expect(res.body.attended_at).toBeDefined();
    });
  });

  describe('PUT /meetings/:id (Update Meeting)', () => {
    it('should return 403 when Member attempts to update meeting', async () => {
      await request(app.getHttpServer())
        .put(`/meetings/${testMeetingId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);
    });

    it('should return 200 when Admin updates meeting details', async () => {
      const res = await request(app.getHttpServer())
        .put(`/meetings/${testMeetingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated E2E Meeting',
          status: MeetingStatus.COMPLETED,
        })
        .expect(200);

      expect(res.body.title).toBe('Updated E2E Meeting');
      expect(res.body.status).toBe(MeetingStatus.COMPLETED);
    });
  });

  describe('DELETE /meetings/attendees/:attendeeId (Remove Attendee)', () => {
    it('should return 403 when Member attempts to remove an attendee', async () => {
      await request(app.getHttpServer())
        .delete(`/meetings/attendees/${testAttendeeId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should return 200 when Admin removes an attendee', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/meetings/attendees/${testAttendeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('Attendee removed successfully');
    });
  });

  describe('DELETE /meetings/:id (Delete Meeting)', () => {
    it('should return 403 when Member attempts to delete meeting', async () => {
      await request(app.getHttpServer())
        .delete(`/meetings/${testMeetingId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should return 200 when Admin deletes meeting', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/meetings/${testMeetingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('Meeting deleted successfully');
    });
  });
});
