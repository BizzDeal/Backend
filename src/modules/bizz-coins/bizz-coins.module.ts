import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { BizzCoinWallet } from './entities/bizz-coin-wallet.entity';
import { BizzCoinTransaction } from './entities/bizz-coin-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { BusinessProfile } from '../businesses/entities/business-profile.entity';
import { CustomerBusiness } from '../businesses/entities/customer-business.entity';
import { Offer } from '../offers/entities/offer.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { BizzCoinsService } from './bizz-coins.service';
import { BizzCoinsController } from './bizz-coins.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BizzCoinWallet,
      BizzCoinTransaction,
      User,
      Profile,
      BusinessProfile,
      CustomerBusiness,
      Offer,
      MediaFile,
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    NotificationsModule,
    EventsModule,
    SettingsModule,
  ],
  controllers: [BizzCoinsController],
  providers: [BizzCoinsService],
  exports: [BizzCoinsService],
})
export class BizzCoinsModule {}
