import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as RequestWithUser;
    const forwardedFor = request.headers['x-forwarded-for'];
    
    let ip = '127.0.0.1';
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      ip = forwardedFor[0].trim();
    } else if (request.ip) {
      ip = request.ip;
    } else if (request.socket?.remoteAddress) {
      ip = request.socket.remoteAddress;
    }

    if (request.user?.id) {
      return `${ip}-${request.user.id}`;
    }

    return ip;
  }

  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;

    // Named throttlers like 'auth' or 'upload' should only apply if explicitly requested via @Throttle() on the handler or controller
    if (throttler.name && throttler.name !== 'default') {
      const routeThrottles = this.reflector.getAllAndOverride<Record<string, unknown>>(
        'THROTTLER:THROTTLE',
        [context.getHandler(), context.getClass()],
      );
      if (!routeThrottles || !(throttler.name in routeThrottles)) {
        return true;
      }
    }

    return super.handleRequest(requestProps);
  }

  protected override async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'TOO_MANY_REQUESTS',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
