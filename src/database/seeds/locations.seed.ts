import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { StateExcelParser } from '../../modules/location/parsers/state-excel.parser';
import { DistrictExcelParser } from '../../modules/location/parsers/district-excel.parser';

export async function seedLocations(dataSource: DataSource): Promise<void> {
  const logger = new Logger('SeedLocations');
  logger.log('Checking for States and Districts Excel files to seed...');

  const searchPaths = [
    path.join(process.cwd(), 'src', 'database', 'data'),
    path.join(process.cwd(), 'data'),
    process.cwd(),
  ];

  let statesFilePath: string | null = null;
  let districtsFilePath: string | null = null;

  for (const dir of searchPaths) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.xlsx') && !file.endsWith('.xls')) continue;
        const lower = file.toLowerCase();
        if (!statesFilePath && (lower.includes('state') || lower === 'states.xlsx' || lower === 'states.xls')) {
          statesFilePath = path.join(dir, file);
        } else if (!districtsFilePath && (lower.includes('district') || lower === 'districts.xlsx' || lower === 'districts.xls')) {
          districtsFilePath = path.join(dir, file);
        }
      }
    }
  }

  // 1. Seed States
  if (statesFilePath) {
    logger.log(`Found States Excel file at: ${statesFilePath}. Parsing & seeding...`);
    try {
      const buffer = fs.readFileSync(statesFilePath);
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });

      const parseResult = StateExcelParser.parse(rows, path.basename(statesFilePath), sheetName);
      const validRows = parseResult.validRows;

      logger.log(`Parsed ${validRows.length} valid states. Upserting into database...`);

      // Batch upsert states
      const BATCH_SIZE = 500;
      let upsertedStates = 0;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const chunk = validRows.slice(i, i + BATCH_SIZE);
        for (const item of chunk) {
          await dataSource.query(
            `INSERT INTO states (lgd_code, name, type, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (lgd_code) DO UPDATE
             SET name = EXCLUDED.name, type = EXCLUDED.type, updated_at = NOW()`,
            [item.lgdCode, item.name, item.type],
          );
          upsertedStates++;
        }
      }
      logger.log(`Successfully seeded/upserted ${upsertedStates} States.`);
    } catch (err: any) {
      logger.error(`Failed to seed states from ${statesFilePath}: ${err.message}`, err.stack);
    }
  } else {
    logger.log(
      'No states.xlsx or states.xls found in "src/database/data/", "data/", or root folder. Skipping States seeding.',
    );
  }

  // 2. Seed Districts
  if (districtsFilePath) {
    logger.log(`Found Districts Excel file at: ${districtsFilePath}. Parsing & seeding...`);
    try {
      const buffer = fs.readFileSync(districtsFilePath);
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });

      const parseResult = DistrictExcelParser.parse(rows, path.basename(districtsFilePath), sheetName);
      const validRows = parseResult.validRows;

      logger.log(`Parsed ${validRows.length} valid districts. Mapping State IDs...`);

      // Build state map
      const stateMap = new Map<string, string>();
      const existingStates = await dataSource.query(`SELECT id, lgd_code FROM states`);
      for (const s of existingStates) {
        stateMap.set(s.lgd_code, s.id);
      }

      const BATCH_SIZE = 500;
      let upsertedDistricts = 0;
      let skippedDistricts = 0;

      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const chunk = validRows.slice(i, i + BATCH_SIZE);
        for (const item of chunk) {
          const stateId = stateMap.get(item.stateCode);
          if (!stateId) {
            skippedDistricts++;
            continue;
          }
          await dataSource.query(
            `INSERT INTO districts (lgd_code, state_id, name, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (lgd_code) DO UPDATE
             SET state_id = EXCLUDED.state_id, name = EXCLUDED.name, updated_at = NOW()`,
            [item.lgdCode, stateId, item.name],
          );
          upsertedDistricts++;
        }
      }
      logger.log(
        `Successfully seeded/upserted ${upsertedDistricts} Districts (Skipped ${skippedDistricts} due to missing parent state).`,
      );
    } catch (err: any) {
      logger.error(`Failed to seed districts from ${districtsFilePath}: ${err.message}`, err.stack);
    }
  } else {
    logger.log(
      'No districts.xlsx or districts.xls found in "src/database/data/", "data/", or root folder. Skipping Districts seeding.',
    );
  }
}
