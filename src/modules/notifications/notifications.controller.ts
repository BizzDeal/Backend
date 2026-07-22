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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationType, UserRole } from '../../common/enums';
import {
  CreateNotificationDto,
  SendBulkNotificationDto,
  BroadcastRoleNotificationDto,
  RegisterDeviceDto,
  NotificationQueryDto,
} from './dto/notifications.dto';
import {
  createNotificationSchema,
  sendBulkNotificationSchema,
  broadcastRoleNotificationSchema,
  registerDeviceSchema,
  notificationQuerySchema,
} from './schemas/notifications.schema';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

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
    description:
      'Retrieves all notifications for the authenticated user without pagination. Supports optional filtering by read status and notification type. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications list returned successfully.',
  })
  async findAll(
    @Query(new ZodValidationPipe(notificationQuerySchema))
    query: NotificationQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.findAll(user, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Notification & Dispatch FCM Push',
    description:
      'Creates a notification alert in the database and automatically dispatches a universal Firebase Cloud Messaging (FCM) push notification to all active devices of the target user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created and FCM push dispatched successfully.',
  })
  async create(
    @Body(new ZodValidationPipe(createNotificationSchema))
    body: CreateNotificationDto,
  ) {
    return this.notificationsService.create({
      user_id: body.user_id,
      phone: body.phone,
      title: body.title,
      message: body.message,
      type: body.type || NotificationType.GENERAL,
      data: body.data,
    });
  }

  @Post('send-bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send Push Notification to Multiple Users (by UUIDs or Phone Numbers)',
    description:
      'Creates notification alerts in the database and automatically dispatches universal Firebase Cloud Messaging (FCM) push notifications to a specific list of recipient user UUIDs or phone numbers. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Bulk notifications created and FCM push dispatch initiated successfully.',
  })
  async sendBulk(
    @Body(new ZodValidationPipe(sendBulkNotificationSchema))
    body: SendBulkNotificationDto,
  ) {
    return this.notificationsService.sendBulkToUsers({
      user_ids: body.user_ids,
      phones: body.phones,
      title: body.title,
      message: body.message,
      type: body.type || NotificationType.GENERAL,
      data: body.data,
    });
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Broadcast Push Notification to All Members',
    description:
      'Creates notification alerts in the database and automatically dispatches universal Firebase Cloud Messaging (FCM) push notifications to all active Members/Entrepreneurs across the platform. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Broadcast notifications created for all members and FCM push dispatch initiated successfully.',
  })
  async broadcastToMembers(
    @Body(new ZodValidationPipe(broadcastRoleNotificationSchema))
    body: BroadcastRoleNotificationDto,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.broadcastToRole(
      UserRole.MEMBER,
      {
        title: body.title,
        message: body.message,
        type: body.type || NotificationType.GENERAL,
        data: body.data,
      },
      user,
    );
  }

  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Broadcast Push Notification to All Customers',
    description:
      'Creates notification alerts in the database and automatically dispatches universal Firebase Cloud Messaging (FCM) push notifications to all active Customers across the platform. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Broadcast notifications created for all customers and FCM push dispatch initiated successfully.',
  })
  async broadcastToCustomers(
    @Body(new ZodValidationPipe(broadcastRoleNotificationSchema))
    body: BroadcastRoleNotificationDto,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.broadcastToRole(
      UserRole.CUSTOMER,
      {
        title: body.title,
        message: body.message,
        type: body.type || NotificationType.GENERAL,
        data: body.data,
      },
      user,
    );
  }

  @Get('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Registered Devices',
    description:
      'Retrieves all registered push notification devices (FCM tokens) for the authenticated user without pagination. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Devices list returned successfully.',
  })
  async getDevices(@CurrentUser() user: User) {
    return this.notificationsService.getDevices(user);
  }

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register Push Device (FCM Token)',
    description:
      'Registers or updates a client device FCM registration token for receiving background/terminated OS-level push notifications.',
  })
  @ApiResponse({
    status: 201,
    description: 'Device registered successfully for push notifications.',
  })
  async registerDevice(
    @Body(new ZodValidationPipe(registerDeviceSchema))
    body: RegisterDeviceDto,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.registerDevice(
      body.fcm_token,
      body.device_type,
      body.device_name || null,
      user,
      body.device_model || null,
      body.operating_system || null,
      body.os_version || null,
      body.manufacturer || null,
      body.is_virtual ?? null,
    );
  }

  @Get('devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Device By ID',
    description:
      'Retrieves details of a specific user device record by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Device details returned successfully.',
  })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  async getDeviceById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notificationsService.getDeviceById(id, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Notification By ID',
    description:
      'Retrieves details of a specific notification by UUID. Returns only foreign key IDs without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification details returned successfully.',
  })
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Notification',
    description:
      'Deletes a specific notification by UUID. Users can delete their own notifications; Admins can delete any notification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully.',
  })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.notificationsService.remove(id, user);
    return { message: 'Notification deleted successfully' };
  }
}
