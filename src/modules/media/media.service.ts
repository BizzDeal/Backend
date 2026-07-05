import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaFile } from './entities/media-file.entity';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { MediaType, MediaPurpose } from '../../common/enums';
import { randomUUID } from 'crypto';

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
   */
  async saveFile(
    file: Express.Multer.File,
    userId: string,
    purpose: MediaPurpose = MediaPurpose.GENERAL,
  ): Promise<MediaFile> {
    const bucket = this.firebaseService.getBucket();
    const uniqueId = randomUUID();
    const cleanFileName = (file.originalname || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const destinationPath = `uploads/${userId}/${purpose}/${uniqueId}-${cleanFileName}`;

    const fileRef = bucket.file(destinationPath);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    let fileUrl: string;
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      fileUrl = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media`;
    } else {
      try {
        await fileRef.makePublic();
      } catch (err) {
        this.logger.warn(
          `Could not make file public directly: ${err instanceof Error ? err.message : err}`,
        );
      }
      fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media`;
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
      mime_type: file.mimetype,
      file_size: file.size,
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
