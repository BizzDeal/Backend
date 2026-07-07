import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatWsDocsController } from './chat-ws-docs.controller';
import { ChatGateway } from './chat.gateway';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatConversation, ChatMessage, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
    NotificationsModule,
    MediaModule,
  ],
  controllers: [ChatController, ChatWsDocsController],
  providers: [ChatService, ChatGateway, WsJwtAuthGuard],
  exports: [ChatService],
})
export class ChatModule {}
