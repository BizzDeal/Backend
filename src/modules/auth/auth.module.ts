import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { OtpRequest } from './entities/otp-request.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Msg91Service } from './services/msg91.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpRequest, RefreshToken, User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'bizz_deal_access_secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') as any) || '1h',
        },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, Msg91Service],
  exports: [AuthService, Msg91Service, JwtModule],
})
export class AuthModule {}
