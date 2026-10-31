import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Project } from '../../projects/schemas/project.schema';
import { User } from '../../users/schemas/user.schema';

export type TaskDocument = HydratedDocument<Task>;

export enum TaskStatus {
  Todo = 'todo',
  InProgress = 'in_progress',
  Done = 'done',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

@Schema({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
})
export class Task {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ trim: true, maxlength: 5000, default: '' })
  description: string;

  @Prop({ type: String, enum: Object.values(TaskStatus), default: TaskStatus.Todo })
  status: TaskStatus;

  @Prop({ type: String, enum: Object.values(TaskPriority), default: TaskPriority.Medium })
  priority: TaskPriority;

  @Prop({ type: SchemaTypes.ObjectId, ref: Project.name, required: true })
  project: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, default: null })
  assignee: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  dueDate: Date | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ project: 1, status: 1, createdAt: -1 });
TaskSchema.index({ assignee: 1, status: 1 });
