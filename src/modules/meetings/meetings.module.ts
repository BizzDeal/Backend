import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Meeting } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { User } from '../users/entities/user.entity';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingAttendee, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    NotificationsModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
