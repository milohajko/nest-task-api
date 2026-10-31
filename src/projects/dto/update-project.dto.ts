import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

/** Every field of CreateProjectDto, but optional (PATCH semantics). */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
