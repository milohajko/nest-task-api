import { ApiProperty } from '@nestjs/swagger';

/** Swagger response shape for register, login and refresh. */
export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({
    example: { id: '66f1...', email: 'ada@example.com', name: 'Ada Lovelace', role: 'user' },
  })
  user: Record<string, unknown>;
}
