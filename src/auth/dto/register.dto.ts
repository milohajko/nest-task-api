import { CreateUserDto } from '../../users/dto/create-user.dto';

/** Registration takes exactly the same fields as creating a user. */
export class RegisterDto extends CreateUserDto {}
