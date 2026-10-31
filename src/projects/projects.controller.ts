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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project owned by the current user' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects the current user owns or is a member of' })
  findAll(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.projectsService.findAllForUser(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one project' })
  findOne(@CurrentUser('id') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.projectsService.findOneForUser(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (owner only)' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project (owner only)' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseObjectIdPipe) id: string) {
    return this.projectsService.remove(id, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member by email (owner only)' })
  addMember(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(id, userId, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member (owner only)' })
  removeMember(
    @CurrentUser('id') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('memberId', ParseObjectIdPipe) memberId: string,
  ) {
    return this.projectsService.removeMember(id, userId, memberId);
  }
}
