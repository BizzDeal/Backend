import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { BizzCoinsModule } from './modules/bizz-coins/bizz-coins.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { ChatModule } from './modules/chat/chat.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { LocationModule } from './modules/location/location.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EventsModule } from './modules/events/events.module';
import { PaymentSettingsModule } from './modules/payment-settings/payment-settings.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MailModule } from './modules/mail/mail.module';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('THROTTLE_TTL') || 60000,
          limit: configService.get<number>('THROTTLE_LIMIT') || 120,
        },
        {
          name: 'auth',
          ttl: configService.get<number>('THROTTLE_AUTH_TTL') || 60000,
          limit: configService.get<number>('THROTTLE_AUTH_LIMIT') || 5,
        },
        {
          name: 'upload',
          ttl: configService.get<number>('THROTTLE_UPLOAD_TTL') || 60000,
          limit: configService.get<number>('THROTTLE_UPLOAD_LIMIT') || 10,
        },
      ],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600000,
    }),
    DatabaseModule,
    FirebaseModule,
    AnalyticsModule,
    UsersModule,
    AuthModule,
    MailModule,
    MediaModule,
    BusinessesModule,
    OffersModule,
    VouchersModule,
    WalletModule,
    BizzCoinsModule,
    ReferralsModule,
    NotificationsModule,
    AuditModule,
    ChatModule,
    MeetingsModule,
    LocationModule,
    EventsModule,
    PaymentSettingsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}

