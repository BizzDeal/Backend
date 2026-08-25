import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ChatModule } from '../chat/chat.module';
import { BizzCoinsModule } from '../bizz-coins/bizz-coins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    ChatModule,
    BizzCoinsModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
