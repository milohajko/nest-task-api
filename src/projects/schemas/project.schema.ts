import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ProjectDocument = HydratedDocument<Project>;

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
export class Project {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 2000, default: '' })
  description: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true, index: true })
  owner: Types.ObjectId;

  /** Users (besides the owner) allowed to see the project and work on its tasks. */
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: User.name }], default: [], index: true })
  members: Types.ObjectId[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
