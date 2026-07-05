import {
  Controller,
  Get,
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
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get All Audit Logs (Admin Only)',
    description:
      'Retrieves all system audit logs without pagination. Returns only foreign key IDs (user_id, entity_id) without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires Admin role.',
  })
  async findAll() {
    return this.auditService.findAllLogs();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Audit Log By ID (Admin Only)',
    description:
      'Retrieves details of a specific audit log by UUID. Returns only foreign key IDs (user_id, entity_id) without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log details returned successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires Admin role.',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log not found.',
  })
  async findOne(@Param('id') id: string) {
    return this.auditService.findLogById(id);
  }
}
