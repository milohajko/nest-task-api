import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/interfaces/paginated.interface';
import { UsersService } from '../users/users.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project, ProjectDocument } from './schemas/project.schema';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    private readonly usersService: UsersService,
  ) {}

  create(ownerId: string, dto: CreateProjectDto): Promise<ProjectDocument> {
    return this.projectModel.create({ ...dto, owner: new Types.ObjectId(ownerId) });
  }

  /** Projects where the user is owner OR member. */
  async findAllForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ProjectDocument>> {
    const uid = new Types.ObjectId(userId);
    const filter = { $or: [{ owner: uid }, { members: uid }] };
    const [items, total] = await Promise.all([
      this.projectModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.projectModel.countDocuments(filter).exec(),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  /** Returns 404 for missing and inaccessible projects alike, so ids cannot be enumerated. */
  async findOneForUser(projectId: string, userId: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId).exec();
    if (!project || !this.hasAccess(project, userId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<ProjectDocument> {
    const project = await this.findOneForUser(projectId, userId);
    this.assertOwner(project, userId);
    Object.assign(project, dto);
    return project.save();
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const project = await this.findOneForUser(projectId, userId);
    this.assertOwner(project, userId);
    await project.deleteOne();
  }

  async addMember(projectId: string, userId: string, dto: AddMemberDto): Promise<ProjectDocument> {
    const project = await this.findOneForUser(projectId, userId);
    this.assertOwner(project, userId);

    const member = await this.usersService.findByEmail(dto.email);
    if (!member) throw new NotFoundException(`No user with email ${dto.email}`);

    const alreadyIn =
      project.owner.equals(member._id) || project.members.some((m) => m.equals(member._id));
    if (!alreadyIn) {
      project.members.push(member._id);
      await project.save();
    }
    return project;
  }

  async removeMember(
    projectId: string,
    userId: string,
    memberId: string,
  ): Promise<ProjectDocument> {
    const project = await this.findOneForUser(projectId, userId);
    this.assertOwner(project, userId);
    project.members = project.members.filter((m) => !m.equals(memberId));
    return project.save();
  }

  hasAccess(project: ProjectDocument, userId: string): boolean {
    return project.owner.equals(userId) || project.members.some((m) => m.equals(userId));
  }

  private assertOwner(project: ProjectDocument, userId: string): void {
    if (!project.owner.equals(userId)) {
      throw new ForbiddenException('Only the project owner can do this');
    }
  }
}
