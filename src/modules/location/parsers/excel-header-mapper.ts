import { BadRequestException } from '@nestjs/common';

export interface HeaderDetectionResult {
  headerRowIndex: number;
  titleRowIndex: number | null;
  title: string | null;
  headers: string[];
  headerIndexMap: Map<string, number>;
}

export class ExcelHeaderMapper {
  /**
   * Detects title row and header row from raw sheet 2D array (`sheet_to_json({ header: 1 })`).
   * Searches the first 10 rows for key required header substrings.
   */
  static detectHeaders(
    rows: any[][],
    requiredHeaderKeys: string[],
    fileName: string,
  ): HeaderDetectionResult {
    let headerRowIndex = -1;
    let titleRowIndex: number | null = null;
    let title: string | null = null;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const normalizedRowCells = row.map((cell) =>
        cell ? String(cell).trim().replace(/\s+/g, ' ').toLowerCase() : '',
      );

      // Check if this row contains at least the primary required header keys
      const matchesRequired = requiredHeaderKeys.every((req) =>
        normalizedRowCells.some((cell) => cell === req.toLowerCase() || cell.includes(req.toLowerCase())),
      );

      if (matchesRequired) {
        headerRowIndex = i;
        if (i > 0 && rows[0] && rows[0].length > 0) {
          titleRowIndex = 0;
          title = String(rows[0][0]).trim();
        }
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        `Fatal Excel validation error in ${fileName}: Missing required headers. Expected headers containing [${requiredHeaderKeys.join(', ')}]`,
      );
    }

    const rawHeaders = rows[headerRowIndex] || [];
    const headers = rawHeaders.map((h) => (h ? String(h).trim().replace(/\s+/g, ' ') : ''));
    const headerIndexMap = new Map<string, number>();

    headers.forEach((h, idx) => {
      if (h) {
        headerIndexMap.set(h.toLowerCase(), idx);
      }
    });

    return {
      headerRowIndex,
      titleRowIndex,
      title,
      headers,
      headerIndexMap,
    };
  }

  /**
   * Get column index by exact or partial header name match.
   */
  static getColumnIndex(headerIndexMap: Map<string, number>, candidates: string[]): number {
    for (const cand of candidates) {
      const lower = cand.toLowerCase();
      if (headerIndexMap.has(lower)) {
        return headerIndexMap.get(lower)!;
      }
      // Check partial match if exact match not found
      for (const [key, idx] of headerIndexMap.entries()) {
        if (key.includes(lower) || lower.includes(key)) {
          return idx;
        }
      }
    }
    return -1;
  }
}
