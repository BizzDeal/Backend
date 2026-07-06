import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { UserDevice } from './entities/user-device.entity';
import { FirebaseModule } from '../../common/firebase/firebase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserDevice]),
    FirebaseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
