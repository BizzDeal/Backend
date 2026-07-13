import { Express } from 'express';

export interface SyncUploadedFiles {
  statesFile?: Express.Multer.File[];
  districtsFile?: Express.Multer.File[];
}

export interface SyncRowError {
  file: string;
  originalFilename?: string;
  sheet: string;
  row: number;
  code: string;
  reason: string;
  values: Record<string, any>;
}

export interface SyncFileReport {
  fileName: string;
  sheetName: string;
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  errors: SyncRowError[];
}
