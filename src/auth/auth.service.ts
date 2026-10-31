import { createHash, randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppConfig } from '../config/configuration';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, TokenPair } from './interfaces/auth-user.interface';

export interface AuthResult extends TokenPair {
  user: UserDocument;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create(dto);
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    // same message for unknown email and wrong password
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueSession(user);
  }

  /** Rotates the refresh token; a replayed old token revokes the whole session. */
  async refresh(userId: string, presentedRefreshToken: string): Promise<AuthResult> {
    const user = await this.usersService.findById(userId);
    if (!user?.refreshTokenHash) throw new ForbiddenException('Session expired, please log in');

    const matches = await bcrypt.compare(
      this.fingerprint(presentedRefreshToken),
      user.refreshTokenHash,
    );
    if (!matches) {
      await this.usersService.setRefreshTokenHash(userId, null);
      throw new ForbiddenException('Refresh token reuse detected, please log in again');
    }

    return this.issueSession(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  private async issueSession(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.signTokens({
      sub: user.id as string,
      email: user.email,
      role: user.role,
    });
    const refreshTokenHash = await bcrypt.hash(this.fingerprint(tokens.refreshToken), 10);
    await this.usersService.setRefreshTokenHash(user.id as string, refreshTokenHash);
    return { ...tokens, user };
  }

  /** bcrypt reads only 72 bytes; JWTs of one user share a longer prefix, so hash the whole token first. */
  private fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('base64');
  }

  private async signTokens(payload: JwtPayload): Promise<TokenPair> {
    const jwt = this.config.get('jwt', { infer: true });
    // env gives plain strings; jsonwebtoken types expiresIn as `ms.StringValue`
    type Ttl = JwtSignOptions['expiresIn'];
    // jti keeps tokens unique even when signed within the same second
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwt.accessSecret,
        expiresIn: jwt.accessTtl as Ttl,
        jwtid: randomUUID(),
      }),
      this.jwtService.signAsync(payload, {
        secret: jwt.refreshSecret,
        expiresIn: jwt.refreshTtl as Ttl,
        jwtid: randomUUID(),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
