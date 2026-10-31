import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from '../projects/projects.module';
import { Task, TaskSchema } from './schemas/task.schema';
import { MyTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]), ProjectsModule],
  controllers: [TasksController, MyTasksController],
  providers: [TasksService],
})
export class TasksModule {}
