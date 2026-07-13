import { StateType } from '../enums/location.enum';
import { ExcelValueNormalizer } from './excel-value-normalizer';
import { ExcelHeaderMapper, HeaderDetectionResult } from './excel-header-mapper';

export interface ParsedStateRow {
  rowNum: number;
  lgdCode: string;
  name: string;
  type: StateType;
}

export interface StateParserResult {
  headerDetection: HeaderDetectionResult;
  validRows: ParsedStateRow[];
  errors: Record<string, any>[];
  totalRowsProcessed: number;
}

export class StateExcelParser {
  static parse(rows: any[][], fileName: string, sheetName: string): StateParserResult {
    const headerDetection = ExcelHeaderMapper.detectHeaders(
      rows,
      ['State Code', 'State Name (In English)'],
      fileName,
    );

    const { headerRowIndex, headerIndexMap } = headerDetection;
    const codeIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['state code']);
    const nameIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['state name (in english)', 'state name']);
    const typeIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['state or ut']);

    const validRows: ParsedStateRow[] = [];
    const errors: Record<string, any>[] = [];
    let totalRowsProcessed = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const lgdCode = ExcelValueNormalizer.normalizeCode(row[codeIdx]);
      const name = ExcelValueNormalizer.normalizeText(row[nameIdx]);
      const rawType = typeIdx >= 0 ? ExcelValueNormalizer.normalizeText(row[typeIdx]) : null;

      if (!lgdCode && !name) {
        // Empty row
        continue;
      }
      totalRowsProcessed++;

      if (!lgdCode || !name) {
        errors.push({
          file: 'statesFile',
          originalFilename: fileName,
          sheet: sheetName,
          row: i + 1,
          code: 'MISSING_REQUIRED_STATE_FIELDS',
          reason: !lgdCode ? 'State Code is missing or invalid' : 'State Name is missing or empty',
          values: { stateCode: lgdCode || '', stateName: name || '' },
        });
        continue;
      }

      let type = StateType.STATE;
      if (rawType && (rawType.toUpperCase() === 'U' || rawType.toUpperCase().includes('UNION'))) {
        type = StateType.UNION_TERRITORY;
      } else if (rawType && (rawType.toUpperCase() === 'S' || rawType.toUpperCase().includes('STATE'))) {
        type = StateType.STATE;
      }

      validRows.push({
        rowNum: i + 1,
        lgdCode,
        name,
        type,
      });
    }

    return {
      headerDetection,
      validRows,
      errors,
      totalRowsProcessed,
    };
  }
}
