import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { Business } from '../businesses/entities/business.entity';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MediaFile, Business]),
    AuditModule,
    MediaModule,
    BusinessesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
