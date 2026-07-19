import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Offer } from './entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';
import { MediaModule } from '../media/media.module';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';

import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer, Business, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    MediaModule,
    SettingsModule,
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
