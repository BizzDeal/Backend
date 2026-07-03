import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
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
  getProfileSchema,
  GetProfileDto,
} from './schemas/users.schema';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
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
  async findAll(): Promise<
    (Omit<User, 'pin_hash'> & { profile_pic_url: string | null })[]
  > {
    return this.usersService.findAll();
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
  @ApiOperation({
    summary: 'Get All Members',
    description:
      'Retrieves a list of all members along with profile pictures and business details.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of members returned successfully.',
  })
  async findMembers() {
    return this.usersService.findMembers();
  }

  @Get('customers')
  @ApiOperation({
    summary: 'Get All Customers',
    description:
      'Retrieves a list of all customers along with profile pictures.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of customers returned successfully.',
  })
  async findCustomers() {
    return this.usersService.findCustomers();
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get User Profile',
    description:
      'Retrieves the profile details of the user by accepting userId in the request payload.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async getProfile(
    @Body(new ZodValidationPipe(getProfileSchema)) dto: GetProfileDto,
  ) {
    return this.usersService.getProfile(dto.userId);
  }

  @Put('profile')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update Own Profile',
    description:
      'Updates the profile details of the user (full_name, phone, whatsapp, email, address, and member business details) along with replacement file uploads (profile_pic and business_logo).',
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
    @Req() req: any,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
    @UploadedFiles()
    files?: {
      profile_pic?: Express.Multer.File[];
      business_logo?: Express.Multer.File[];
    },
  ) {
    const userId = req?.user?.id || dto.userId;
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.usersService.updateProfile(userId, dto, files);
  }

  @Put('approve-member')
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
    @Req() req: any,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    const adminId = req?.user?.id || dto.adminId;
    return this.usersService.approveMember(dto.memberId, adminId, ip);
  }

  @Put('reject-member')
  @ApiOperation({
    summary: 'Reject Member',
    description: 'Rejects a member registration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member rejected successfully.',
  })
  async rejectMember(
    @Req() req: any,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    const adminId = req?.user?.id || dto.adminId;
    return this.usersService.rejectMember(dto.memberId, adminId, ip);
  }

  @Put('suspend-member')
  @ApiOperation({
    summary: 'Suspend Member',
    description: 'Suspends an active member and their business profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member suspended successfully.',
  })
  async suspendMember(
    @Req() req: any,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    const adminId = req?.user?.id || dto.adminId;
    return this.usersService.suspendMember(dto.memberId, adminId, ip);
  }

  @Delete('member')
  @ApiOperation({
    summary: 'Delete Member',
    description: 'Deletes a member account from the platform.',
  })
  @ApiResponse({
    status: 200,
    description: 'Member deleted successfully.',
  })
  async deleteMember(
    @Req() req: any,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(memberActionSchema)) dto: MemberActionDto,
  ) {
    const adminId = req?.user?.id || dto.adminId;
    return this.usersService.deleteMember(dto.memberId, adminId, ip);
  }
}
