import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../../common/enums';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: User;
    [key: string]: unknown;
  };
  user?: User;
}

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    try {
      const user = await this.authenticateSocket(client);
      client.data = client.data || {};
      client.data.user = user;
      client.user = user;
      return true;
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Unauthorized',
      );
    }
  }

  async authenticateSocket(
    client: Socket | AuthenticatedSocket,
  ): Promise<User> {
    const token = this.extractTokenFromSocket(client);
    if (!token) {
      throw new WsException('Authentication token missing');
    }

    try {
      const payload: unknown = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
      });

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sub' in payload) ||
        typeof payload.sub !== 'string'
      ) {
        throw new WsException('Invalid token payload');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new WsException('User not found');
      }

      if (
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.REJECTED ||
        user.status === UserStatus.UNVERIFIED
      ) {
        throw new WsException('User account is unverified, suspended, or rejected');
      }

      return user;
    } catch (err) {
      if (err instanceof WsException) {
        throw err;
      }
      throw new WsException('Invalid or expired access token');
    }
  }

  private extractTokenFromSocket(
    client: Socket | AuthenticatedSocket,
  ): string | undefined {
    let token: string | undefined;

    const authObj = client.handshake.auth as { token?: string } | undefined;
    const queryObj = client.handshake.query as { token?: string } | undefined;
    const headersObj = client.handshake.headers;

    if (authObj && typeof authObj.token === 'string') {
      token = authObj.token;
    } else if (headersObj && typeof headersObj.authorization === 'string') {
      token = headersObj.authorization;
    } else if (queryObj && typeof queryObj.token === 'string') {
      token = queryObj.token;
    }

    if (token && token.startsWith('Bearer ')) {
      return token.slice(7).trim();
    }
    return token?.trim();
  }
}
