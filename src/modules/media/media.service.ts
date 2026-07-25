import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaFile } from './entities/media-file.entity';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { MediaType, MediaPurpose } from '../../common/enums';
import { FILE_SIZE_LIMITS } from '../../common/constants/file-limit.constants';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(MediaFile)
    private readonly mediaRepository: Repository<MediaFile>,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Uploads a file to Firebase Storage and records its metadata in the DB.
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

    const bucket = this.firebaseService.getBucket();
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

    const fileRef = bucket.file(destinationPath);
    const downloadToken = randomUUID();

    await fileRef.save(uploadBuffer, {
      metadata: {
        contentType: uploadMimeType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    let fileUrl: string;
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      fileUrl = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media&token=${downloadToken}`;
    } else {
      try {
        await fileRef.makePublic();
      } catch (err) {
        this.logger.warn(
          `Could not make file public directly: ${err instanceof Error ? err.message : err}`,
        );
      }
      fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media&token=${downloadToken}`;
    }

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
      file_url: fileUrl,
      public_id: destinationPath,
      file_type: fileType,
      purpose,
      mime_type: uploadMimeType,
      file_size: uploadSize,
    });

    return this.mediaRepository.save(mediaRecord);
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
          const bucket = this.firebaseService.getBucket();
          await bucket.file(oldFile.public_id).delete();
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
   * Deletes a specific media file record and its corresponding Firebase storage object.
   */
  async deleteFileById(mediaId: string): Promise<void> {
    const mediaFile = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!mediaFile) return;

    if (mediaFile.public_id) {
      try {
        const bucket = this.firebaseService.getBucket();
        await bucket.file(mediaFile.public_id).delete();
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
}
