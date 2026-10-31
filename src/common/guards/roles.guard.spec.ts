import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
  const guard = new RolesGuard(reflector);

  const contextWithUser = (role?: Role): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    }) as unknown as ExecutionContext;

  it('allows any authenticated user when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser(Role.User))).toBe(true);
  });

  it('allows a user that has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin]);
    expect(guard.canActivate(contextWithUser(Role.Admin))).toBe(true);
  });

  it('denies a user missing the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin]);
    expect(guard.canActivate(contextWithUser(Role.User))).toBe(false);
  });

  it('denies when there is no user on the request', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });
});
