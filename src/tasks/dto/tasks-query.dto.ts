import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TaskPriority, TaskStatus } from '../schemas/task.schema';

export const TASK_SORT_FIELDS = ['createdAt', 'dueDate', 'priority', 'status', 'title'] as const;

/** `GET /projects/:id/tasks?status=todo&priority=high&assignee=...&sort=-dueDate&page=1&limit=20` */
export class TasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by assignee user id' })
  @IsOptional()
  @IsMongoId()
  assignee?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive search in the title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by; prefix with "-" for descending',
    example: '-createdAt',
    enum: [...TASK_SORT_FIELDS, ...TASK_SORT_FIELDS.map((f) => `-${f}`)],
  })
  @IsOptional()
  @IsIn([...TASK_SORT_FIELDS, ...TASK_SORT_FIELDS.map((f) => `-${f}`)])
  sort: string = '-createdAt';
}
