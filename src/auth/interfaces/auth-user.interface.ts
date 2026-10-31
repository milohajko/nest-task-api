import { Role } from '../../common/enums/role.enum';

/** What `request.user` looks like after the JWT strategy validated a token. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Claims we put inside both access and refresh tokens. */
export interface JwtPayload {
  sub: string; // user id (standard "subject" claim)
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
