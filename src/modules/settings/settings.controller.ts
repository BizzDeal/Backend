import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { updateSettingsSchema } from './schemas/settings.schema';
import type { UpdateSettingsDto } from './schemas/settings.schema';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MEMBER, UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Platform Settings',
    description: 'Retrieves current global platform settings like feed limits and deal thresholds.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings retrieved successfully.',
  })
  async getSettings() {
    const data = await this.settingsService.getSettings();
    return {
      success: true,
      data,
    };
  }

  @Put('platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Platform Settings (Admin Only)',
    description: 'Updates global platform settings like feed limits and deal thresholds.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings updated successfully.',
  })
  async updateSettings(
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(dto);
  }

  @Post('cache/clear')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear System Cache (Admin Only)',
    description: 'Manually clear the global cache, forcing fresh database queries for static data.',
  })
  @ApiResponse({
    status: 200,
    description: 'System cache cleared successfully.',
  })
  async clearCache() {
    return this.settingsService.clearSystemCache();
  }
}
