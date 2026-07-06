import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { UserDevice } from './entities/user-device.entity';
import { User } from '../users/entities/user.entity';
import { FirebaseModule } from '../../common/firebase/firebase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserDevice, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    FirebaseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
