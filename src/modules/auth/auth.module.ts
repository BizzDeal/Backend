import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { FirebaseModule } from '../../common/firebase/firebase.module';
import { MediaModule } from '../media/media.module';
import { LocationModule } from '../location/location.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_ACCESS_SECRET') || 'bizz_deal_access_secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') ||
            '1h') as unknown as number,
        },
      }),
    }),
    UsersModule,
    BusinessesModule,
    FirebaseModule,
    MediaModule,
    LocationModule,
    ReferralsModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService, JwtModule, OtpService],
})
export class AuthModule {}
