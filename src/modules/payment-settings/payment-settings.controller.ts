import { Controller, Get, Put, Body, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentSettingsService } from './payment-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { updatePaymentSettingsSchema, UpdatePaymentSettingsDto } from './schemas/payment-settings.schema';

@ApiTags('Payment Settings')
@Controller('payment-settings')
export class PaymentSettingsController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current payment details and settings (Public)' })
  @ApiResponse({ status: 200, description: 'Settings returned successfully' })
  async getSettings() {
    return this.paymentSettingsService.getSettings();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update payment settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async updateSettings(
    @Body(new ZodValidationPipe(updatePaymentSettingsSchema)) dto: UpdatePaymentSettingsDto,
  ) {
    const updated = await this.paymentSettingsService.updateSettings(dto);
    return {
      success: true,
      message: 'Payment settings updated successfully',
      data: updated,
    };
  }
}
