import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Meetings')
@Controller('meetings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Meeting',
    description: 'Creates a new meeting record.',
  })
  @ApiResponse({ status: 201, description: 'Meeting created successfully.' })
  async create(
    @Body() body: { title: string; description?: string; meeting_date: string; location?: string; meeting_link?: string; business_id?: string },
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.create(body, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Meetings',
    description: 'Retrieves all meetings for the authenticated user without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Meetings list returned successfully.' })
  async findAll(@CurrentUser() user: User) {
    return this.meetingsService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Meeting By ID',
    description: 'Retrieves details of a specific meeting by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Meeting details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Meeting not found.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.meetingsService.findOne(id, user);
  }

  @Post(':id/attendees')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add Attendee to Meeting',
    description: 'Invites a user to a meeting.',
  })
  @ApiResponse({ status: 201, description: 'Attendee added successfully.' })
  async addAttendee(@Param('id') id: string, @Body() body: { user_id: string }, @CurrentUser() user: User) {
    return this.meetingsService.addAttendee(id, body.user_id, user);
  }

  @Get(':id/attendees')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Attendees for Meeting',
    description: 'Retrieves all attendees for a specific meeting without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Attendees list returned successfully.' })
  async getAttendees(@Param('id') id: string, @CurrentUser() user: User) {
    return this.meetingsService.getAttendees(id, user);
  }

  @Get('attendees/:attendeeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Attendee By ID',
    description: 'Retrieves details of a specific meeting attendee record by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Attendee details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Attendee not found.' })
  async getAttendeeById(@Param('attendeeId') attendeeId: string, @CurrentUser() user: User) {
    return this.meetingsService.getAttendeeById(attendeeId, user);
  }
}
