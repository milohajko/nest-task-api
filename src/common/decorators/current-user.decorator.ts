import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';

/** Injects the authenticated user, or one of its fields: `@CurrentUser('id')`. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
