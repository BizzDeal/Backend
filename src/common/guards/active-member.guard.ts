import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus, UserRole } from '../enums';

@Injectable()
export class ActiveMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.role === UserRole.MEMBER && user.status === UserStatus.PENDING) {
      throw new ForbiddenException(
        'Pending members cannot perform this action',
      );
    }

    return true;
  }
}
