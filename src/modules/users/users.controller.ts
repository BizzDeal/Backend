import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  userExistSchema,
  UserExistDto,
  updateProfileSchema,
  UpdateProfileDto,
  memberActionSchema,
  MemberActionDto,
} from './schemas/users.schema';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '../../common/enums';
import { RegionFilterDto } from '../../common/dto/region-filter.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get All Users',
    description:
      'Retrieves a list of all registered users along with their profile picture URL (profile_pic_url).',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of users returned successfully along with profile_pic_url.',
  })
  async findAll(@Query() filter?: RegionFilterDto): Promise<
    (Omit<User, 'pin_hash'> & { profile_pic_url: string | null })[]
  > {
    return this.usersService.findAll(filter);
  }

  @Post('user-exist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check User Existence',
    description:
      'Checks whether a user exists with the specified phone number.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns existence status.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number provided.',
  })
  async checkUserExist(
    @Body(new ZodValidationPipe(userExistSchema)) dto: UserExistDto,
  ) {
    return this.usersService.checkUserExist(dto.phone);
  }

  @Get('members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get All Members',
    description:
      'Retrieves a list of all members along with profile pictures and business details.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of members returned successfully.',
  })
  async findMembers(@Query('status') status?: UserStatus, @Query() filter?: RegionFilterDto) {
    return this.usersService.findMembers(status, filter);
  }

  @Get('customers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get All Customers',
    description:
      'Retrieves a list of all customers along with profile pictures.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of customers returned successfully.',
  })
  async findCustomers(@Query() filter?: RegionFilterDto) {
    return this.usersService.findCustomers(filter);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get User Profile',
    description:
      'Retrieves the profile details of the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update Own Profile',
    description:
      'Updates the profile details of the currently authenticated user along with replacement file uploads (profile_pic and business_logo).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profile_pic', maxCount: 1 },
      { name: 'business_logo', maxCount: 1 },
    ]),
  )
  async updateProfile(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
    @UploadedFiles()
    files?: {
      profile_pic?: Express.Multer.File[];
      business_logo?: Express.Multer.File[];
    },
  ) {
    return this.usersService.updateProfile(user.id, dto, files);
  }

  @Put('approve-member')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve Member',
    description:
      'Approves a pending member registration and activates their business profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member approved successfully.',
  })
  async approveMember(
    @CurrentUser() admin: User,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    return this.usersService.approveMember(dto.memberId, admin.id, ip);
  }

  @Put('reject-member')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject Member',
    description: 'Rejects a member registration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member rejected successfully.',
  })
  async rejectMember(
    @CurrentUser() admin: User,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    return this.usersService.rejectMember(dto.memberId, admin.id, ip);
  }

  @Put('suspend-member')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Suspend Member',
    description: 'Suspends an active member and their business profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member suspended successfully.',
  })
  async suspendMember(
    @CurrentUser() admin: User,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    return this.usersService.suspendMember(dto.memberId, admin.id, ip);
  }

  @Delete('member')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete Member',
    description: 'Deletes a member account from the platform.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member deleted successfully.',
  })
  async deleteMember(
    @CurrentUser() admin: User,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    return this.usersService.deleteMember(dto.memberId, admin.id, ip);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get User By ID',
    description:
      'Retrieves public or detailed profile information for any registered user by UUID. Returns only foreign key IDs (such as business_id) without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'User details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
