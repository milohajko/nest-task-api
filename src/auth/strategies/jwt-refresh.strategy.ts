import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { AuthUser, JwtPayload } from '../interfaces/auth-user.interface';

export interface RefreshUser extends AuthUser {
  refreshToken: string;
}

/** Validates the refresh token sent in the body and passes it through for hash comparison. */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: (req: Request) =>
        (req.body as { refreshToken?: string })?.refreshToken ?? null,
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.refreshSecret', { infer: true }),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RefreshUser {
    const refreshToken = (req.body as { refreshToken: string }).refreshToken;
    return { id: payload.sub, email: payload.email, role: payload.role, refreshToken };
  }
}
