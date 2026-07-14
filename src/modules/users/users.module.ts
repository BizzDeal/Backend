import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { Business } from '../businesses/entities/business.entity';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { LocationModule } from '../location/location.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MediaFile, Business]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    AuditModule,
    MediaModule,
    BusinessesModule,
    LocationModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
