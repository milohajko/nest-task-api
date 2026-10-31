import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { paginate, Paginated } from '../common/interfaces/paginated.interface';
import { ProjectDocument } from '../projects/schemas/project.schema';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskDocument } from './schemas/task.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(projectId: string, userId: string, dto: CreateTaskDto): Promise<TaskDocument> {
    const project = await this.projectsService.findOneForUser(projectId, userId);
    this.assertAssigneeIsMember(project, dto.assignee);

    return this.taskModel.create({
      ...dto,
      project: project._id,
      createdBy: new Types.ObjectId(userId),
      assignee: dto.assignee ? new Types.ObjectId(dto.assignee) : null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
  }

  async findAllInProject(
    projectId: string,
    userId: string,
    query: TasksQueryDto,
  ): Promise<Paginated<TaskDocument>> {
    await this.projectsService.findOneForUser(projectId, userId);

    const filter: FilterQuery<TaskDocument> = { project: new Types.ObjectId(projectId) };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.assignee) filter.assignee = new Types.ObjectId(query.assignee);
    if (query.search) filter.title = { $regex: escapeRegex(query.search), $options: 'i' };

    const [items, total] = await Promise.all([
      this.taskModel.find(filter).sort(query.sort).skip(query.skip).limit(query.limit).exec(),
      this.taskModel.countDocuments(filter).exec(),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  /** Tasks assigned to the current user, across all projects. */
  async findAssignedTo(userId: string, query: TasksQueryDto): Promise<Paginated<TaskDocument>> {
    const filter: FilterQuery<TaskDocument> = { assignee: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

    const [items, total] = await Promise.all([
      this.taskModel.find(filter).sort(query.sort).skip(query.skip).limit(query.limit).exec(),
      this.taskModel.countDocuments(filter).exec(),
    ]);
    return paginate(items, total, query.page, query.limit);
  }

  async findOne(projectId: string, taskId: string, userId: string): Promise<TaskDocument> {
    await this.projectsService.findOneForUser(projectId, userId);
    const task = await this.taskModel.findOne({ _id: taskId, project: projectId }).exec();
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return task;
  }

  async update(
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDocument> {
    const project = await this.projectsService.findOneForUser(projectId, userId);
    this.assertAssigneeIsMember(project, dto.assignee);

    const task = await this.taskModel.findOne({ _id: taskId, project: projectId }).exec();
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    const { assignee, dueDate, ...rest } = dto;
    Object.assign(task, rest);
    if (assignee !== undefined) task.assignee = assignee ? new Types.ObjectId(assignee) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    return task.save();
  }

  async remove(projectId: string, taskId: string, userId: string): Promise<void> {
    await this.projectsService.findOneForUser(projectId, userId);
    const result = await this.taskModel.deleteOne({ _id: taskId, project: projectId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Task ${taskId} not found`);
  }

  private assertAssigneeIsMember(project: ProjectDocument, assignee?: string): void {
    if (assignee && !this.projectsService.hasAccess(project, assignee)) {
      throw new BadRequestException('Assignee must be the owner or a member of the project');
    }
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
