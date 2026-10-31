import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { Task, TaskPriority, TaskStatus } from './schemas/task.schema';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { TasksService } from './tasks.service';

/** Builds a chainable fake of `Model.find().sort().skip().limit().exec()`. */
function chain<T>(result: T) {
  const q: any = {};
  for (const m of ['sort', 'skip', 'limit']) q[m] = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(result);
  return q;
}

describe('TasksService', () => {
  let service: TasksService;
  let taskModel: Record<string, jest.Mock>;
  let projectsService: { findOneForUser: jest.Mock; hasAccess: jest.Mock };

  const ownerId = new Types.ObjectId().toHexString();
  const memberId = new Types.ObjectId().toHexString();
  const project = {
    _id: new Types.ObjectId(),
    owner: new Types.ObjectId(ownerId),
    members: [new Types.ObjectId(memberId)],
  };

  beforeEach(async () => {
    taskModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
    };
    projectsService = {
      findOneForUser: jest.fn().mockResolvedValue(project),
      hasAccess: jest.fn(
        (p: typeof project, uid: string) =>
          p.owner.equals(uid) || p.members.some((m) => m.equals(uid)),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  describe('create', () => {
    it('creates the task bound to the project and creator', async () => {
      taskModel.create.mockImplementation((doc: unknown) => Promise.resolve(doc));

      const result: any = await service.create(project._id.toHexString(), ownerId, {
        title: 'Write docs',
        assignee: memberId,
        dueDate: '2026-12-31T00:00:00.000Z',
      });

      expect(projectsService.findOneForUser).toHaveBeenCalledWith(
        project._id.toHexString(),
        ownerId,
      );
      expect(result.project).toEqual(project._id);
      expect(result.createdBy.toHexString()).toBe(ownerId);
      expect(result.assignee.toHexString()).toBe(memberId);
      expect(result.dueDate).toBeInstanceOf(Date);
    });

    it('rejects an assignee who is not part of the project', async () => {
      const stranger = new Types.ObjectId().toHexString();

      await expect(
        service.create(project._id.toHexString(), ownerId, { title: 'x', assignee: stranger }),
      ).rejects.toThrow(BadRequestException);
      expect(taskModel.create).not.toHaveBeenCalled();
    });

    it('propagates 404 when the user cannot see the project', async () => {
      projectsService.findOneForUser.mockRejectedValue(new NotFoundException());

      await expect(
        service.create(project._id.toHexString(), 'someone', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllInProject', () => {
    it('builds the Mongo filter from the query and returns a paginated envelope', async () => {
      const items = [{ title: 'a' }, { title: 'b' }];
      taskModel.find.mockReturnValue(chain(items));
      taskModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(42) });

      const query = Object.assign(new TasksQueryDto(), {
        status: TaskStatus.Todo,
        priority: TaskPriority.High,
        search: 'a.b',
        page: 2,
        limit: 10,
        sort: '-dueDate',
      });
      const result = await service.findAllInProject(project._id.toHexString(), ownerId, query);

      const filter = taskModel.find.mock.calls[0][0];
      expect(filter.project).toEqual(project._id);
      expect(filter.status).toBe('todo');
      expect(filter.priority).toBe('high');
      expect(filter.title).toEqual({ $regex: 'a\\.b', $options: 'i' });
      expect(taskModel.find.mock.results[0].value.sort).toHaveBeenCalledWith('-dueDate');
      expect(taskModel.find.mock.results[0].value.skip).toHaveBeenCalledWith(10);
      expect(result).toEqual({ items, meta: { total: 42, page: 2, limit: 10, pages: 5 } });
    });
  });

  describe('remove', () => {
    it('throws 404 when nothing was deleted', async () => {
      taskModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      await expect(
        service.remove(project._id.toHexString(), new Types.ObjectId().toHexString(), ownerId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
