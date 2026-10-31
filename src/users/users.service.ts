import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/interfaces/paginated.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.userModel.create({ email: dto.email, name: dto.name, passwordHash });
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdOrFail(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<UserDocument>> {
    const [items, total] = await Promise.all([
      this.userModel.find().sort({ createdAt: -1 }).skip(query.skip).limit(query.limit).exec(),
      this.userModel.countDocuments().exec(),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async setRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { refreshTokenHash: hash }).exec();
  }
}
