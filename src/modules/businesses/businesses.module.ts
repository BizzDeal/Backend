import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { BusinessProfile } from './entities/business-profile.entity';
import { BusinessCategory } from './entities/business-category.entity';
import { User } from '../users/entities/user.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { MediaModule } from '../media/media.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessProfile, BusinessCategory, User, MediaFile]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    MediaModule,
    AuditModule,
    SettingsModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
