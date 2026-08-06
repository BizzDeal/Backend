import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaFile } from './entities/media-file.entity';
import { MediaType, MediaPurpose } from '../../common/enums';
import { FILE_SIZE_LIMITS } from '../../common/constants/file-limit.constants';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_DEFAULT_REGION') || 'auto',
      endpoint: this.configService.get<string>('AWS_ENDPOINT_URL'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
      // Railway/Cloudflare/etc compatible options
      forcePathStyle: false,
    });
  }

  /**
   * Uploads a file to S3 storage and records its metadata in the DB.
   * Enforces file size limits and compresses image uploads authoritatively to WebP format via sharp.
   */
  async saveFile(
    file: Express.Multer.File,
    userId: string,
    purpose: MediaPurpose = MediaPurpose.GENERAL,
  ): Promise<MediaFile> {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }

    const isAudio = file.mimetype ? file.mimetype.startsWith('audio/') : false;
    const maxAllowedSize = isAudio
      ? FILE_SIZE_LIMITS.MAX_AUDIO_FILE_SIZE_BYTES
      : FILE_SIZE_LIMITS.MAX_GENERAL_FILE_SIZE_BYTES;

    if (file.size > maxAllowedSize) {
      const limitMB = maxAllowedSize / (1024 * 1024);
      const actualMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size (${actualMB} MB) exceeds the maximum allowed limit of ${limitMB} MB`,
      );
    }

    const uniqueId = randomUUID();
    const cleanFileName = (file.originalname || 'file').replace(
      /[^a-zA-Z0-9.\-_]/g,
      '_',
    );

    let uploadBuffer = file.buffer;
    let uploadMimeType = file.mimetype;
    let uploadSize = file.size;

    // Authoritative WebP Image Compression via sharp (excluding vector SVGs)
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
      try {
        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        uploadBuffer = compressedBuffer;
        uploadMimeType = 'image/webp';
        uploadSize = compressedBuffer.length;
      } catch (err) {
        this.logger.warn(
          `Image compression failed for ${file.originalname}, falling back to raw buffer: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const dotIndex = cleanFileName.lastIndexOf('.');
    const baseFileName = dotIndex > 0 ? cleanFileName.substring(0, dotIndex) : cleanFileName;
    const finalFileName = uploadMimeType === 'image/webp' ? `${baseFileName}.webp` : cleanFileName;

    const destinationPath = `uploads/${userId}/${purpose}/${uniqueId}-${finalFileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: destinationPath,
        Body: uploadBuffer,
        ContentType: uploadMimeType,
      })
    );

    let fileType = MediaType.DOCUMENT;
    if (file.mimetype.startsWith('image/')) {
      fileType = MediaType.IMAGE;
    } else if (file.mimetype.startsWith('video/')) {
      fileType = MediaType.VIDEO;
    } else if (file.mimetype.startsWith('audio/')) {
      fileType = MediaType.AUDIO;
    }

    const mediaRecord = this.mediaRepository.create({
      uploaded_by_id: userId,
      file_url: '', // We will update this after saving
      public_id: destinationPath,
      file_type: fileType,
      purpose,
      mime_type: uploadMimeType,
      file_size: uploadSize,
    });

    const savedRecord = await this.mediaRepository.save(mediaRecord);
    
    // Set file_url pointing to our local proxy/redirect endpoint
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    savedRecord.file_url = `${backendUrl}/bizzdeal/api/media/file/${savedRecord.id}`;
    
    return this.mediaRepository.save(savedRecord);
  }

  /**
   * Replaces any existing file for a given user and purpose by deleting stale files
   * from storage and DB, then uploading the new file.
   */
  async replaceUserFile(
    file: Express.Multer.File,
    userId: string,
    purpose: MediaPurpose,
  ): Promise<MediaFile> {
    const oldFiles = await this.mediaRepository.find({
      where: { uploaded_by_id: userId, purpose },
    });

    for (const oldFile of oldFiles) {
      if (oldFile.public_id) {
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: oldFile.public_id,
            })
          );
        } catch (err) {
          this.logger.warn(
            `Could not delete old storage file (${oldFile.public_id}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    if (oldFiles.length > 0) {
      await this.mediaRepository.remove(oldFiles);
    }

    return this.saveFile(file, userId, purpose);
  }

  /**
   * Deletes a specific media file record and its corresponding storage object.
   */
  async deleteFileById(mediaId: string): Promise<void> {
    const mediaFile = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!mediaFile) return;

    if (mediaFile.public_id) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: mediaFile.public_id,
          })
        );
      } catch (err) {
        this.logger.warn(
          `Could not delete storage file (${mediaFile.public_id}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await this.mediaRepository.remove(mediaFile);
  }

  async getFileById(mediaId: string): Promise<MediaFile> {
    const mediaFile = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!mediaFile) {
      throw new NotFoundException('Media file not found');
    }

    return mediaFile;
  }

  /**
   * Generates a pre-signed S3 GET URL for the specified media ID.
   */
  async getPresignedUrl(mediaId: string): Promise<string> {
    const mediaFile = await this.getFileById(mediaId);
    if (!mediaFile.public_id) {
      throw new NotFoundException('Media file has no associated storage key');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: mediaFile.public_id,
    });

    // URL valid for 1 hour
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
