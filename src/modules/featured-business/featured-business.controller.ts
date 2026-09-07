import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { FeaturedBusinessService } from './featured-business.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createFeaturedRequestSchema,
  CreateFeaturedRequestDto,
  rejectFeaturedRequestSchema,
  RejectFeaturedRequestDto,
  queryFeaturedRequestSchema,
  QueryFeaturedRequestDto,
} from './schemas/featured-business.schema';

@ApiTags('Featured Business Requests')
@Controller('featured-business')
export class FeaturedBusinessController {
  constructor(
    private readonly featuredBusinessService: FeaturedBusinessService,
  ) {}

  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('banner', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit or Update a Featured Business Request',
    description:
      'Submits a request for a business to be featured in its category for a defined date range. Only one live featured business is permitted per category. Past dates are strictly not allowed.',
  })
  @ApiResponse({
    status: 201,
    description: 'Featured business request submitted successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request: Date validation failed or another featured business is currently live in this category.',
  })
  async submitRequest(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createFeaturedRequestSchema))
    dto: CreateFeaturedRequestDto,
    @UploadedFile() bannerFile?: Express.Multer.File,
  ) {
    return this.featuredBusinessService.createRequest(dto, user, bannerFile);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Member Featured Business Requests',
    description: 'Retrieves all featured business requests submitted by the authenticated member.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of featured business requests returned successfully.',
  })
  async getMyRequests(@CurrentUser() user: User) {
    return this.featuredBusinessService.getMyRequests(user);
  }

  @Get('category-status/:categoryId')
  @ApiOperation({
    summary: 'Check Category Featured Status',
    description:
      'Checks whether the specified category currently has a live, approved featured business.',
  })
  @ApiParam({
    name: 'categoryId',
    type: String,
    description: 'UUID of the business category',
  })
  @ApiResponse({
    status: 200,
    description: 'Category live status returned successfully.',
  })
  async getCategoryStatus(@Param('categoryId') categoryId: string) {
    return this.featuredBusinessService.getCategoryLiveStatus(categoryId);
  }

  @Get('admin/requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin: List All Featured Business Requests',
    description: 'Retrieves all featured business requests with optional status and category filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all featured business requests returned successfully.',
  })
  async getAllRequests(
    @Query(new ZodValidationPipe(queryFeaturedRequestSchema))
    query: QueryFeaturedRequestDto,
  ) {
    return this.featuredBusinessService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Featured Business Request by ID',
    description: 'Retrieves single featured business request details by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the featured business request',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured request found and returned.',
  })
  @ApiResponse({
    status: 404,
    description: 'Featured request not found.',
  })
  async getById(@Param('id') id: string) {
    return this.featuredBusinessService.findById(id);
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: Approve Featured Business Request',
    description:
      'Approves a featured business request. Fails if another request in the same category is currently live or scheduled to overlap.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the request to approve',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured request approved successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot approve: Category already has a live featured business.',
  })
  async approveRequest(
    @Param('id') id: string,
    @CurrentUser() adminUser: User,
  ) {
    return this.featuredBusinessService.approveRequest(id, adminUser);
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin: Reject Featured Business Request',
    description: 'Rejects a featured business request with a provided reason.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the request to reject',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured request rejected successfully.',
  })
  async rejectRequest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectFeaturedRequestSchema))
    dto: RejectFeaturedRequestDto,
    @CurrentUser() adminUser: User,
  ) {
    return this.featuredBusinessService.rejectRequest(id, dto, adminUser);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel Pending Featured Business Request',
    description: 'Allows a member to cancel their pending featured business request.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the request to cancel',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured request cancelled successfully.',
  })
  async cancelRequest(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.featuredBusinessService.cancelRequest(id, user);
  }
}
