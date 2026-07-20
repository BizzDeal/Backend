import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeetingStatus, AttendeeStatus } from '../../../common/enums';

export class CreateMeetingDto {
  @ApiProperty({
    description: 'Title of the meeting',
    type: String,
    example: 'Quarterly Strategy Review',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description or agenda of the meeting',
    type: String,
    example: 'Discussing Q3 financial targets and expansion plans.',
  })
  description?: string;

  @ApiProperty({
    description: 'Scheduled date and time of the meeting in ISO format',
    type: String,
    format: 'date-time',
    example: '2026-08-15T10:00:00Z',
  })
  meeting_date: string;

  @ApiPropertyOptional({
    description: 'Physical location of the meeting',
    type: String,
    example: 'Conference Room A, 4th Floor',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'Online meeting link (e.g. Zoom, Google Meet)',
    type: String,
    example: 'https://meet.google.com/abc-defg-hij',
  })
  meeting_link?: string;

  @ApiPropertyOptional({
    description: 'UUID of the business associated with this meeting',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  business_id?: string;
}

export class UpdateMeetingDto {
  @ApiPropertyOptional({
    description: 'Updated title of the meeting',
    type: String,
    example: 'Updated Quarterly Strategy Review',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated description or agenda of the meeting',
    type: String,
    example: 'Updated agenda items.',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated date and time of the meeting in ISO format',
    type: String,
    format: 'date-time',
    example: '2026-08-16T11:00:00Z',
  })
  meeting_date?: string;

  @ApiPropertyOptional({
    description: 'Updated physical location of the meeting',
    type: String,
    example: 'Conference Room B',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'Updated online meeting link',
    type: String,
    example: 'https://meet.google.com/xyz-uvw-rst',
  })
  meeting_link?: string;

  @ApiPropertyOptional({
    description: 'Status of the meeting',
    enum: MeetingStatus,
    example: MeetingStatus.COMPLETED,
  })
  status?: MeetingStatus;
}

export class AddAttendeeDto {
  @ApiProperty({
    description: 'UUID of the member user to invite to the meeting',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;
}

export class UpdateAttendeeStatusDto {
  @ApiProperty({
    description:
      'New attendance status. Members can RSVP as ACCEPTED or REJECTED. Admins can mark as ATTENDED or MISSED.',
    enum: AttendeeStatus,
    example: AttendeeStatus.ACCEPTED,
  })
  status: AttendeeStatus;
}

export class RsvpDto {
  @ApiProperty({
    description: 'RSVP status (ACCEPTED or REJECTED)',
    enum: AttendeeStatus,
    example: AttendeeStatus.ACCEPTED,
  })
  status: AttendeeStatus;
}

export class MeetingQueryDto {
  @ApiPropertyOptional({
    description: 'Filter meetings by status',
    enum: MeetingStatus,
    example: MeetingStatus.SCHEDULED,
  })
  status?: MeetingStatus;

  @ApiPropertyOptional({
    description: 'Filter meetings by associated business UUID',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  business_id?: string;

  @ApiPropertyOptional({
    description: 'Filter meetings scheduled on or after this date (ISO format)',
    type: String,
    format: 'date-time',
    example: '2026-08-01T00:00:00Z',
  })
  from_date?: string;

  @ApiPropertyOptional({
    description:
      'Filter meetings scheduled on or before this date (ISO format)',
    type: String,
    format: 'date-time',
    example: '2026-08-31T23:59:59Z',
  })
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated state UUIDs for filtering',
  })
  states?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated district UUIDs for filtering',
  })
  districts?: string;
}
