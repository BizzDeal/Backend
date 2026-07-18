import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { FirebaseModule } from './common/firebase/firebase.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { OffersModule } from './modules/offers/offers.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { ChatModule } from './modules/chat/chat.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { LocationModule } from './modules/location/location.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EventsModule } from './modules/events/events.module';
import { PaymentSettingsModule } from './modules/payment-settings/payment-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    FirebaseModule,
    AnalyticsModule,
    UsersModule,
    AuthModule,
    MediaModule,
    BusinessesModule,
    OffersModule,
    VouchersModule,
    WalletModule,
    ReferralsModule,
    NotificationsModule,
    AuditModule,
    ChatModule,
    MeetingsModule,
    LocationModule,
    EventsModule,
    PaymentSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
