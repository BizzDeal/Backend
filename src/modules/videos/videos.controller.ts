import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveMemberGuard } from '../../common/guards/active-member.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createVideoSchema,
  CreateVideoDto,
  updateVideoSchema,
  UpdateVideoDto,
  videoQuerySchema,
  VideoQueryDto,
} from './schemas/videos.schema';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get public active video feed',
    description: 'Retrieve paginated active videos with category, type, and search filters.',
  })
  @ApiResponse({ status: 200, description: 'Videos retrieved successfully' })
  async getPublicVideos(
    @Query(new ZodValidationPipe(videoQuerySchema)) query: VideoQueryDto,
    @CurrentUser() user?: User,
  ) {
    return this.videosService.getPublicVideos(query, user?.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get authenticated member videos',
    description: 'Returns all videos posted by the logged-in member.',
  })
  @ApiResponse({ status: 200, description: 'Member videos retrieved successfully' })
  async getMyVideos(@CurrentUser() user: User) {
    return this.videosService.getMyVideos(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get single video by ID',
  })
  @ApiResponse({ status: 200, description: 'Video retrieved successfully' })
  async getVideoById(
    @Param('id') id: string,
    @CurrentUser() user?: User,
  ) {
    return this.videosService.getVideoById(id, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveMemberGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create/Post a new video',
    description: 'Allows active members and admins to post videos.',
  })
  @ApiResponse({ status: 201, description: 'Video created successfully' })
  async createVideo(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createVideoSchema)) dto: CreateVideoDto,
  ) {
    return this.videosService.createVideo(user.id, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveMemberGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing video',
  })
  @ApiResponse({ status: 200, description: 'Video updated successfully' })
  async updateVideo(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateVideoSchema)) dto: UpdateVideoDto,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.videosService.updateVideo(id, user.id, dto, isAdmin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a video',
  })
  @ApiResponse({ status: 200, description: 'Video deleted successfully' })
  async deleteVideo(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.videosService.deleteVideo(id, user.id, isAdmin);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Increment video view count',
  })
  async recordView(@Param('id') id: string) {
    return this.videosService.incrementViews(id);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle like on a video',
  })
  async recordLike(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.videosService.toggleLike(id, user.id);
  }
}
