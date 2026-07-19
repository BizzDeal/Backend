import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PlatformSettings } from './entities/platform-settings.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSettings, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
