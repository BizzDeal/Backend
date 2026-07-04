import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  updateBusinessSchema,
  UpdateBusinessDto,
  businessQuerySchema,
  BusinessQueryDto,
  featureBusinessSchema,
  FeatureBusinessDto,
} from './schemas/businesses.schema';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) { }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Business Categories',
    description:
      'Retrieves a list of all active business categories sorted alphabetically.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of business categories successfully retrieved.',
  })
  async getCategories() {
    return this.businessesService.getCategories();
  }

  @Get('featured')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Featured Businesses',
    description: 'Retrieves a list of active featured businesses.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of featured businesses returned successfully.',
  })
  async getFeatured(@CurrentUser() user?: User) {
    return this.businessesService.findFeatured({}, user);
  }

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search Businesses',
    description:
      'Searches active businesses by keyword or field filters matching business details (name, description, website, gst_number), owner details (full_name, phone, whatsapp, email, address), or category details (name, slug, description).',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters.',
  })
  async search(
    @Query() queryParams: BusinessQueryDto,
    @CurrentUser() user?: User,
  ) {
    let query: BusinessQueryDto = {};
    try {
      query = businessQuerySchema.parse(queryParams || {});
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
    return this.businessesService.findAll(query, user);
  }

  @Get('category/:categoryId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Businesses By Category',
    description: 'Retrieves active businesses under a specific category.',
  })
  @ApiResponse({
    status: 200,
    description: 'Businesses in category returned successfully.',
  })
  async getByCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user?: User,
  ) {
    return this.businessesService.findByCategory(categoryId, {}, user);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get All Businesses',
    description: 'Retrieves a list of active businesses without pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of businesses returned successfully.',
  })
  async findAll(@CurrentUser() user?: User) {
    return this.businessesService.findAll({}, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Business Details',
    description: 'Retrieves full details of a specific business listing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Business details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found.',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.businessesService.findOne(id, user);
  }

  @Put('feature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Feature or Unfeature Business (Admin Only)',
    description:
      'Allows administrators to control whether an active business is featured on the platform.',
  })
  @ApiResponse({
    status: 200,
    description: 'Business featured status updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires Admin role.',
  })
  @ApiResponse({
    status: 404,
    description: 'Business not found.',
  })
  async featureBusiness(
    @Body(new ZodValidationPipe(featureBusinessSchema))
    dto: FeatureBusinessDto,
    @CurrentUser() user: User,
    @Ip() ip?: string,
  ) {
    return this.businessesService.featureBusiness(
      dto.businessId,
      dto.is_featured,
      user.id,
      ip,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update Business Listing',
    description:
      'Updates an existing business listing. Both the listing owner (Member) and Admins can update a listing. Whenever a member updates their listing, its status automatically resets to PENDING for admin re-approval. Admins do not require re-approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Business listing updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient rights.',
  })
  @UseInterceptors(FileInterceptor('business_logo'))
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateBusinessSchema)) dto: UpdateBusinessDto,
    @UploadedFile() business_logo?: Express.Multer.File,
    @Ip() ip?: string,
  ) {
    return this.businessesService.update(
      id,
      user.id,
      user.role,
      dto,
      business_logo,
      ip,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete Business Listing',
    description:
      'Deletes a business listing and associated logo files. Verifies that actor has rights (must be listing owner or Admin).',
  })
  @ApiResponse({
    status: 200,
    description: 'Business listing deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient rights.',
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Ip() ip?: string,
  ) {
    return this.businessesService.delete(id, user.id, user.role, ip);
  }
}
