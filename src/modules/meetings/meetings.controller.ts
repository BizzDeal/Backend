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
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  AddAttendeeDto,
  UpdateAttendeeStatusDto,
  MeetingQueryDto,
  RsvpDto,
} from './dto/meetings.dto';
import {
  createMeetingSchema,
  updateMeetingSchema,
  addAttendeeSchema,
  updateAttendeeStatusSchema,
  meetingQuerySchema,
  rsvpSchema,
} from './schemas/meetings.schema';

@ApiTags('Meetings')
@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Meeting (Admin Only)',
    description:
      'Creates a new meeting record. Only Admins can create meetings.',
  })
  @ApiResponse({ status: 201, description: 'Meeting created successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admin can create meetings.',
  })
  async create(
    @Body(new ZodValidationPipe(createMeetingSchema)) body: CreateMeetingDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.create(body, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Meetings',
    description:
      'Retrieves meetings with optional filters without pagination. Admins see all meetings; Members see meetings they are invited to. Customers are blocked from accessing this endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Meetings list returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Customers cannot access meetings.',
  })
  async findAll(
    @Query(new ZodValidationPipe(meetingQuerySchema)) query: MeetingQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Meeting By ID',
    description:
      'Retrieves details of a specific meeting by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Meeting details returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Meeting not found.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.meetingsService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Meeting (Admin Only)',
    description:
      'Updates meeting details or status. Only Admins can update meetings. Cancelling a meeting triggers notifications to attendees.',
  })
  @ApiResponse({ status: 200, description: 'Meeting updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin only.' })
  @ApiResponse({ status: 404, description: 'Meeting not found.' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMeetingSchema)) body: UpdateMeetingDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.update(id, body, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Meeting (Admin Only)',
    description: 'Deletes a meeting record and cascade deletes attendees.',
  })
  @ApiResponse({ status: 200, description: 'Meeting deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin only.' })
  @ApiResponse({ status: 404, description: 'Meeting not found.' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.meetingsService.remove(id, user);
  }

  @Post(':id/attendees')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add Attendee to Meeting (Admin Only)',
    description: 'Invites a user to a meeting and sends a notification.',
  })
  @ApiResponse({ status: 201, description: 'Attendee added successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin only.' })
  async addAttendee(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addAttendeeSchema)) body: AddAttendeeDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.addAttendee(id, body.user_id, user);
  }

  @Get(':id/attendees')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Attendees for Meeting',
    description:
      'Retrieves all attendees for a specific meeting without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendees list returned successfully.',
  })
  async getAttendees(@Param('id') id: string, @CurrentUser() user: User) {
    return this.meetingsService.getAttendees(id, user);
  }

  @Get('attendees/:attendeeId')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Attendee By ID',
    description:
      'Retrieves details of a specific meeting attendee record by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendee details returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Attendee not found.' })
  async getAttendeeById(
    @Param('attendeeId') attendeeId: string,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.getAttendeeById(attendeeId, user);
  }

  @Put(':id/attendees/:attendeeId')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Attendee Status (RSVP or Attendance Tracking)',
    description:
      'Members can update their own RSVP status (ACCEPTED or REJECTED). Admins can mark attendance (ATTENDED or MISSED).',
  })
  @ApiResponse({ status: 200, description: 'Attendee status updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden action or role.' })
  async updateAttendeeStatus(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Body(new ZodValidationPipe(updateAttendeeStatusSchema))
    body: UpdateAttendeeStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.updateAttendeeStatus(
      id,
      attendeeId,
      body.status,
      user,
    );
  }

  @Put('attendees/:attendeeId')
  @Roles(UserRole.ADMIN, UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Attendee Status by Attendee ID (RSVP / Attendance)',
    description:
      'Shortcut endpoint to update attendee status directly by attendee UUID.',
  })
  @ApiResponse({ status: 200, description: 'Attendee status updated.' })
  async updateAttendeeStatusDirect(
    @Param('attendeeId') attendeeId: string,
    @Body(new ZodValidationPipe(updateAttendeeStatusSchema))
    body: UpdateAttendeeStatusDto,
    @CurrentUser() user: User,
  ) {
    const attendee = await this.meetingsService.getAttendeeById(
      attendeeId,
      user,
    );
    return this.meetingsService.updateAttendeeStatus(
      attendee.meeting_id,
      attendeeId,
      body.status,
      user,
    );
  }

  @Delete(':id/attendees/:attendeeId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove Attendee from Meeting (Admin Only)',
    description: 'Removes an attendee record. Can only be executed by Admin.',
  })
  @ApiResponse({ status: 200, description: 'Attendee removed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin only.' })
  async removeAttendee(
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.removeAttendee(id, attendeeId, user);
  }

  @Delete('attendees/:attendeeId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove Attendee by Attendee ID (Admin Only)',
    description:
      'Shortcut endpoint to remove attendee directly by UUID. Can only be executed by Admin.',
  })
  @ApiResponse({ status: 200, description: 'Attendee removed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin only.' })
  async removeAttendeeDirect(
    @Param('attendeeId') attendeeId: string,
    @CurrentUser() user: User,
  ) {
    const attendee = await this.meetingsService.getAttendeeById(
      attendeeId,
      user,
    );
    return this.meetingsService.removeAttendee(
      attendee.meeting_id,
      attendeeId,
      user,
    );
  }

  @Put(':id/rsvp')
  @Roles(UserRole.MEMBER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit RSVP for Meeting',
    description: 'Members use this to provide their RSVP (ACCEPTED or REJECTED) to a meeting. Upserts the attendee record.',
  })
  @ApiResponse({ status: 200, description: 'RSVP updated successfully.' })
  async rsvpMeeting(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rsvpSchema)) body: RsvpDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.rsvpMeeting(id, body.status, user);
  }

  @Get(':id/attendee-report')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Attendee Report (Admin Only)',
    description: 'Retrieves a list of all relevant members for a meeting along with their RSVP status (including PENDING).',
  })
  @ApiResponse({ status: 200, description: 'Report returned successfully.' })
  async getAttendeeReport(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.getMeetingAttendeeReport(id, user);
  }
}
