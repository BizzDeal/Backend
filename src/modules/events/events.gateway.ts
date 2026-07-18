import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  WsJwtAuthGuard,
  type AuthenticatedSocket,
} from '../chat/guards/ws-jwt-auth.guard';
import { User } from '../users/entities/user.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/events',
})
@UseGuards(WsJwtAuthGuard)
export class AppEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppEventsGateway.name);

  constructor(
    private readonly wsJwtAuthGuard: WsJwtAuthGuard,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user: User = await this.wsJwtAuthGuard.authenticateSocket(client);
      const authClient = client as AuthenticatedSocket;
      authClient.data = authClient.data || {};
      authClient.data.user = user;
      authClient.user = user;

      // Join user's personal events room
      await client.join(`user_events_${user.id}`);
      this.logger.log(`Client connected to events: ${client.id} (User: ${user.id})`);
    } catch (error) {
      this.logger.warn(
        `Events Connection rejected for socket ${client.id}: ${error instanceof Error ? error.message : 'Unauthorized'}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const authClient = client as AuthenticatedSocket;
    const user: User | undefined = authClient.data?.user || authClient.user;
    if (user) {
      this.logger.log(`Client disconnected from events: ${client.id} (User: ${user.id})`);
    }
  }

  /**
   * Emits a generic app event to a specific user
   */
  emitToUser(userId: string, type: string, payload: any) {
    this.server.to(`user_events_${userId}`).emit('app_event', {
      type,
      payload,
      timestamp: new Date().toISOString()
    });
  }
}
