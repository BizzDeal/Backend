import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppEventsGateway } from './events.gateway';
import { User } from '../users/entities/user.entity';
import { WsJwtAuthGuard } from '../chat/guards/ws-jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
  ],
  providers: [AppEventsGateway, WsJwtAuthGuard],
  exports: [AppEventsGateway],
})
export class EventsModule {}
