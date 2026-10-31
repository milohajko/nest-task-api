import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { Role } from '../common/enums/role.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmail' | 'findById' | 'setRefreshTokenHash'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const jwtConfig = {
    accessSecret: 'a'.repeat(32),
    accessTtl: '15m',
    refreshSecret: 'r'.repeat(32),
    refreshTtl: '7d',
  };

  const fingerprint = (token: string) => createHash('sha256').update(token).digest('base64');
  const hashToken = (token: string) => bcrypt.hash(fingerprint(token), 4);

  const makeUser = async (overrides: Record<string, unknown> = {}) => ({
    id: '66f1a2b3c4d5e6f7a8b9c0d1',
    email: 'ada@example.com',
    role: Role.User,
    passwordHash: await bcrypt.hash('correct-password', 4),
    refreshTokenHash: null as string | null,
    ...overrides,
  });

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation((_payload, opts: { secret: string }) =>
          Promise.resolve(opts.secret === jwtConfig.accessSecret ? 'ACCESS' : 'REFRESH'),
        ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(jwtConfig) } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns a token pair and stores the refresh-token hash on success', async () => {
      const user = await makeUser();
      usersService.findByEmail.mockResolvedValue(user as unknown as UserDocument);

      const result = await service.login({ email: user.email, password: 'correct-password' });

      expect(result.accessToken).toBe('ACCESS');
      expect(result.refreshToken).toBe('REFRESH');
      expect(result.user).toBe(user);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(user.id, expect.any(String));
      const storedHash = usersService.setRefreshTokenHash.mock.calls[0][1] as string;
      expect(storedHash).not.toBe('REFRESH');
      expect(await bcrypt.compare(fingerprint('REFRESH'), storedHash)).toBe(true);
    });

    it('rejects a wrong password with 401', async () => {
      usersService.findByEmail.mockResolvedValue((await makeUser()) as unknown as UserDocument);

      await expect(service.login({ email: 'ada@example.com', password: 'nope' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.setRefreshTokenHash).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same 401 (no user enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login({ email: 'ghost@example.com', password: 'x' })).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('refresh', () => {
    it('rotates the token when the presented refresh token matches the stored hash', async () => {
      const user = await makeUser({ refreshTokenHash: await hashToken('OLD-REFRESH') });
      usersService.findById.mockResolvedValue(user as unknown as UserDocument);

      const result = await service.refresh(user.id, 'OLD-REFRESH');

      expect(result.refreshToken).toBe('REFRESH');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledTimes(1);
    });

    it('revokes the session when a non-matching (already rotated) token is reused', async () => {
      const user = await makeUser({ refreshTokenHash: await hashToken('CURRENT') });
      usersService.findById.mockResolvedValue(user as unknown as UserDocument);

      await expect(service.refresh(user.id, 'STOLEN-OLD-TOKEN')).rejects.toThrow(
        ForbiddenException,
      );
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(user.id, null);
    });

    it('does not treat two JWTs that share their first 72 bytes as the same token', async () => {
      const sharedPrefix = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'x'.repeat(80);
      const current = `${sharedPrefix}.current-signature`;
      const stolen = `${sharedPrefix}.old-signature`;
      const user = await makeUser({ refreshTokenHash: await hashToken(current) });
      usersService.findById.mockResolvedValue(user as unknown as UserDocument);

      await expect(service.refresh(user.id, stolen)).rejects.toThrow(ForbiddenException);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(user.id, null);
    });

    it('rejects when the user is logged out (no stored hash)', async () => {
      usersService.findById.mockResolvedValue((await makeUser()) as unknown as UserDocument);

      await expect(service.refresh('66f1a2b3c4d5e6f7a8b9c0d1', 'anything')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('clears the stored refresh-token hash', async () => {
      await service.logout('user-id');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-id', null);
    });
  });
});
