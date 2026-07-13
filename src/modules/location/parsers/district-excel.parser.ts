import { ExcelValueNormalizer } from './excel-value-normalizer';
import { ExcelHeaderMapper, HeaderDetectionResult } from './excel-header-mapper';

export interface ParsedDistrictRow {
  rowNum: number;
  stateCode: string;
  stateName: string | null;
  lgdCode: string;
  name: string;
}

export interface DistrictParserResult {
  headerDetection: HeaderDetectionResult;
  validRows: ParsedDistrictRow[];
  errors: Record<string, any>[];
  totalRowsProcessed: number;
}

export class DistrictExcelParser {
  static parse(rows: any[][], fileName: string, sheetName: string): DistrictParserResult {
    const headerDetection = ExcelHeaderMapper.detectHeaders(
      rows,
      ['State Code', 'District Code', 'District Name(In English)'],
      fileName,
    );

    const { headerRowIndex, headerIndexMap } = headerDetection;
    const stateCodeIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['state code']);
    const stateNameIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['state name (in english)', 'state name']);
    const distCodeIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['district code']);
    const distNameIdx = ExcelHeaderMapper.getColumnIndex(headerIndexMap, ['district name(in english)', 'district name']);

    const validRows: ParsedDistrictRow[] = [];
    const errors: Record<string, any>[] = [];
    let totalRowsProcessed = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const stateCode = ExcelValueNormalizer.normalizeCode(row[stateCodeIdx]);
      const stateName = stateNameIdx >= 0 ? ExcelValueNormalizer.normalizeText(row[stateNameIdx]) : null;
      const lgdCode = ExcelValueNormalizer.normalizeCode(row[distCodeIdx]);
      const name = ExcelValueNormalizer.normalizeText(row[distNameIdx]);

      if (!stateCode && !lgdCode && !name) continue;
      totalRowsProcessed++;

      if (!stateCode || !lgdCode || !name) {
        errors.push({
          file: 'districtsFile',
          originalFilename: fileName,
          sheet: sheetName,
          row: i + 1,
          code: 'MISSING_REQUIRED_DISTRICT_FIELDS',
          reason: !stateCode
            ? 'State Code is missing'
            : !lgdCode
            ? 'District Code is missing'
            : 'District Name is missing',
          values: { stateCode: stateCode || '', districtCode: lgdCode || '', districtName: name || '' },
        });
        continue;
      }

      validRows.push({
        rowNum: i + 1,
        stateCode,
        stateName,
        lgdCode,
        name,
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
