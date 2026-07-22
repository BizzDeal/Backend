import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { LocationModule } from '../location/location.module';
import { ChatModule } from '../chat/chat.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, MediaFile, BusinessProfile]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    AuditModule,
    MediaModule,
    BusinessesModule,
    LocationModule,
    ChatModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
