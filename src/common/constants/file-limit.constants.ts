/**
 * Application-wide file size limit constants (in bytes).
 */
export const FILE_SIZE_LIMITS = {
  /** Maximum raw image file size: 10 MB */
  MAX_IMAGE_FILE_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum document file size: 10 MB */
  MAX_DOC_FILE_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum audio / voice note file size: 5 MB */
  MAX_AUDIO_FILE_SIZE_BYTES: 5 * 1024 * 1024,

  /** Maximum default general upload limit: 10 MB */
  MAX_GENERAL_FILE_SIZE_BYTES: 10 * 1024 * 1024,
} as const;
