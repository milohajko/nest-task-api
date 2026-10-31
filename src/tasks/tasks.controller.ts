import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task in a project' })
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List / filter / sort / paginate the tasks of a project' })
  findAll(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Query() query: TasksQueryDto,
  ) {
    return this.tasksService.findAllInProject(projectId, userId, query);
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get one task' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    return this.tasksService.findOne(projectId, taskId, userId);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, userId, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('taskId', ParseObjectIdPipe) taskId: string,
  ) {
    return this.tasksService.remove(projectId, taskId, userId);
  }
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class MyTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Tasks assigned to the current user, across all projects' })
  mine(@CurrentUser('id') userId: string, @Query() query: TasksQueryDto) {
    return this.tasksService.findAssignedTo(userId, query);
  }
}
