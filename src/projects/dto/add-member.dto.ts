import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'grace@example.com', description: 'Email of an existing user' })
  @IsEmail()
  email: string;
}
