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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
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
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createOfferSchema,
  CreateOfferDto,
  updateOfferSchema,
  UpdateOfferDto,
  offerQuerySchema,
  OfferQueryDto,
  offerActionSchema,
  OfferActionDto,
} from './schemas/offers.schema';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Offer or Deal',
    description:
      'Creates a new promotional offer or deal for a business. Members can only create offers for their own businesses (starts as PENDING). Admins create offers as APPROVED.',
  })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request: Validation error or inactive business.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Cannot create offer for another user business.',
  })
  @UseInterceptors(FileInterceptor('offer_image'))
  async create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createOfferSchema)) dto: CreateOfferDto,
    @UploadedFile() offer_image?: Express.Multer.File,
  ) {
    return this.offersService.create(dto, user, offer_image);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Offers and Deals',
    description:
      'Retrieves promotional offers with optional filters. Customers and guest users only see APPROVED offers within active dates. Members see all offers for their own businesses.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of offers returned successfully.',
  })
  async findAll(@Query() query: any, @CurrentUser() user?: User) {
    try {
      const parsedQuery = offerQuerySchema.parse(query);
      return await this.offersService.findAll(parsedQuery, user);
    } catch (err: any) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: err.errors || err.message,
      });
    }
  }

  @Put('approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve Offer (Admin Only)',
    description:
      'Approves a pending offer, making it publicly visible to customers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer approved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found.',
  })
  async approve(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(offerActionSchema)) dto: OfferActionDto,
  ) {
    return this.offersService.approve(dto.offer_id, user.id);
  }

  @Put('reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject Offer (Admin Only)',
    description: 'Rejects a pending offer with an optional reason.',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer rejected successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found.',
  })
  async reject(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(offerActionSchema)) dto: OfferActionDto,
  ) {
    return this.offersService.reject(dto.offer_id, user.id, dto.reason);
  }

  @Get('business/:businessId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Offers by Business ID (Admin Only)',
    description:
      'Retrieves all promotional offers for a specific business. Restricted to Admin users only.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of offers for the business returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires Admin role.',
  })
  async getByBusinessId(
    @Param('businessId') businessId: string,
    @CurrentUser() user: User,
  ) {
    return this.offersService.findAll({ business_id: businessId }, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Offer Details',
    description:
      'Retrieves full details of a specific offer by ID. Returns only foreign key IDs (business_id, image_id, approved_by_id) without nested relational objects. Pending/rejected offers are only accessible to the listing owner or Admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer details returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Offer pending approval.',
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found.',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.offersService.findOne(id, user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Offer Details',
    description:
      'Updates an offer or replaces its promotional image. Whenever a member updates an offer, its status automatically resets to PENDING for admin re-approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient rights.',
  })
  @UseInterceptors(FileInterceptor('offer_image'))
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateOfferSchema)) dto: UpdateOfferDto,
    @UploadedFile() offer_image?: Express.Multer.File,
  ) {
    return this.offersService.update(id, dto, user, offer_image);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Offer',
    description:
      'Deletes an offer and cleans up its associated promotional image from storage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Insufficient rights.',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.delete(id, user);
  }
}
