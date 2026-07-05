import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import {
  WsJwtAuthGuard,
  type AuthenticatedSocket,
} from './guards/ws-jwt-auth.guard';
import {
  SendMessageWsSchema,
  MessageDeliveredWsSchema,
  MarkAsReadWsSchema,
  TypingWsSchema,
} from './dto/chat-ws.dto';
import { User } from '../users/entities/user.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
@UseGuards(WsJwtAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly wsJwtAuthGuard: WsJwtAuthGuard,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user: User = await this.wsJwtAuthGuard.authenticateSocket(client);
      const authClient = client as AuthenticatedSocket;
      authClient.data = authClient.data || {};
      authClient.data.user = user;
      authClient.user = user;

      // Track socket ID
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set<string>());
      }
      this.userSockets.get(user.id)!.add(client.id);

      // Join user's personal room for direct messages and notifications
      await client.join(`user_${user.id}`);
      this.chatService.setUserOnlineStatus(user.id, true);

      // Broadcast presence
      this.server.emit('user_online', { user_id: user.id });

      // Send list of currently online users to the newly connected client
      const onlineUserIds = Array.from(this.userSockets.keys());
      client.emit('online_users_list', { user_ids: onlineUserIds });

      this.logger.log(`Client connected: ${client.id} (User: ${user.id})`);
    } catch (error) {
      this.logger.warn(
        `Connection rejected for socket ${client.id}: ${error instanceof Error ? error.message : 'Unauthorized'}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const authClient = client as AuthenticatedSocket;
    const user: User | undefined = authClient.data?.user || authClient.user;
    if (user) {
      const sockets = this.userSockets.get(user.id);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(user.id);
          this.chatService.setUserOnlineStatus(user.id, false);
          this.server.emit('user_offline', {
            user_id: user.id,
            last_seen: new Date(),
          });
        }
      }
      this.logger.log(`Client disconnected: ${client.id} (User: ${user.id})`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.data.user;
      if (!user) {
        throw new WsException('Unauthorized');
      }
      const data = SendMessageWsSchema.parse(payload);

      const message = await this.chatService.sendMessage(
        data.conversation_id,
        data.message || null,
        data.message_type,
        data.media_file_id || null,
        user,
      );

      const conv = await this.chatService.getConversationById(
        data.conversation_id,
        user,
      );
      const recipientId =
        conv.user_one_id === user.id ? conv.user_two_id : conv.user_one_id;

      // Emit to recipient's room
      this.server.to(`user_${recipientId}`).emit('receive_message', message);

      // Return Sent tick acknowledgment (Single Tick)
      return {
        status: 'SENT',
        message_id: message.id,
        created_at: message.created_at,
      };
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Failed to send message',
      );
    }
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.data.user;
      if (!user) {
        throw new WsException('Unauthorized');
      }
      const data = MessageDeliveredWsSchema.parse(payload);
      const conv = await this.chatService.getConversationById(
        data.conversation_id,
        user,
      );
      const senderId =
        conv.user_one_id === user.id ? conv.user_two_id : conv.user_one_id;

      // Emit Delivered tick (Double Tick) to original sender
      this.server.to(`user_${senderId}`).emit('message_status_update', {
        message_id: data.message_id,
        conversation_id: data.conversation_id,
        status: 'DELIVERED',
      });
      return { success: true };
    } catch (error) {
      throw new WsException(
        error instanceof Error
          ? error.message
          : 'Failed to update delivery status',
      );
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.data.user;
      if (!user) {
        throw new WsException('Unauthorized');
      }
      const data = MarkAsReadWsSchema.parse(payload);
      const result = await this.chatService.markMessagesAsRead(
        data.conversation_id,
        user,
      );
      const conv = await this.chatService.getConversationById(
        data.conversation_id,
        user,
      );
      const partnerId =
        conv.user_one_id === user.id ? conv.user_two_id : conv.user_one_id;

      // Emit Blue Ticks to conversation partner
      if (result.updated_count > 0) {
        this.server.to(`user_${partnerId}`).emit('messages_read', {
          conversation_id: data.conversation_id,
          read_by: user.id,
          read_at: result.read_at,
        });
      }

      return { status: 'READ', ...result };
    } catch (error) {
      throw new WsException(
        error instanceof Error
          ? error.message
          : 'Failed to mark messages as read',
      );
    }
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.data.user;
      if (!user) {
        throw new WsException('Unauthorized');
      }
      const data = TypingWsSchema.parse(payload);
      this.server.to(`user_${data.receiver_id}`).emit('user_typing', {
        conversation_id: data.conversation_id,
        sender_id: user.id,
      });
      return { success: true };
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Invalid typing payload',
      );
    }
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.data.user;
      if (!user) {
        throw new WsException('Unauthorized');
      }
      const data = TypingWsSchema.parse(payload);
      this.server.to(`user_${data.receiver_id}`).emit('user_stopped_typing', {
        conversation_id: data.conversation_id,
        sender_id: user.id,
      });
      return { success: true };
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Invalid typing payload',
      );
    }
  }
}
