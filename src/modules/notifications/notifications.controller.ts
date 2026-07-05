import {
  Controller,
  Get,
  Post,
  Put,
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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DeviceType, NotificationType } from '../../common/enums';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Notifications',
    description: 'Retrieves all notifications for the authenticated user without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Notifications list returned successfully.' })
  async findAll(@CurrentUser() user: User) {
    return this.notificationsService.findAll(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Notification',
    description: 'Creates a notification for a user.',
  })
  @ApiResponse({ status: 201, description: 'Notification created successfully.' })
  async create(@Body() body: { user_id: string; title: string; message: string; type?: NotificationType; data?: Record<string, any> }) {
    return this.notificationsService.create({
      user_id: body.user_id,
      title: body.title,
      message: body.message,
      type: body.type || NotificationType.GENERAL,
      data: body.data,
    });
  }

  @Get('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Registered Devices',
    description: 'Retrieves all registered push notification devices for the authenticated user without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Devices list returned successfully.' })
  async getDevices(@CurrentUser() user: User) {
    return this.notificationsService.getDevices(user);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register Device',
    description: 'Registers a device for push notifications.',
  })
  @ApiResponse({ status: 201, description: 'Device registered successfully.' })
  async registerDevice(
    @Body() body: { fcm_token: string; device_type: DeviceType; device_name?: string },
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.registerDevice(
      body.fcm_token,
      body.device_type,
      body.device_name || null,
      user,
    );
  }

  @Get('devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Device By ID',
    description: 'Retrieves details of a specific user device record by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Device details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  async getDeviceById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notificationsService.getDeviceById(id, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Notification By ID',
    description: 'Retrieves details of a specific notification by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({ status: 200, description: 'Notification details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notificationsService.findOne(id, user);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark Notification as Read',
    description: 'Marks a specific notification as read.',
  })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notificationsService.markAsRead(id, user);
  }
}
