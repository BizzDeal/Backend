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
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Media File Details',
    description:
      'Retrieves metadata for a specific uploaded media file by UUID. Returns only foreign key IDs (uploaded_by_id) without nested relational objects.',
  })
  @ApiResponse({
    status: 200,
    description: 'Media file details returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Media file not found.',
  })
  async getFileById(@Param('id') id: string) {
    return this.mediaService.getFileById(id);
  }
}
