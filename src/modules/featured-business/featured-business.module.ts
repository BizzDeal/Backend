import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { FeaturedBusinessRequest } from './entities/featured-business-request.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { BusinessCategory } from '../businesses/entities/business-category.entity';
import { User } from '../users/entities/user.entity';
import { FeaturedBusinessService } from './featured-business.service';
import { FeaturedBusinessController } from './featured-business.controller';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeaturedBusinessRequest,
      BusinessProfile,
      BusinessCategory,
      User,
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    MediaModule,
    NotificationsModule,
    EventsModule,
  ],
  controllers: [FeaturedBusinessController],
  providers: [FeaturedBusinessService],
  exports: [FeaturedBusinessService],
})
export class FeaturedBusinessModule {}
