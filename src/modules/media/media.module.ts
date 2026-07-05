import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MediaFile } from './entities/media-file.entity';
import { User } from '../users/entities/user.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaFile, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
