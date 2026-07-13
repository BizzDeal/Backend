export class ExcelValueNormalizer {
  /**
   * Normalize an LGD code or numeric code to clean string without decimal suffixes like ".0".
   */
  static normalizeCode(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const str = String(value).trim();
    if (str === '-' || str.toUpperCase() === 'NA' || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'NULL') {
      return null;
    }
    // Remove trailing ".0" or ".000..." from Excel number conversion
    return str.replace(/\.0+$/, '');
  }

  /**
   * Normalize text fields: trim, collapse internal spaces, treat empty or placeholder strings as null.
   */
  static normalizeText(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const str = String(value).trim().replace(/\s+/g, ' ');
    if (
      !str ||
      str === '-' ||
      str.toUpperCase() === 'NA' ||
      str.toUpperCase() === 'N/A' ||
      str.toUpperCase() === 'NULL'
    ) {
      return null;
    }
    return str;
  }

  /**
   * Validate and normalize a 6-digit Indian PIN code.
   * Returns null if invalid or missing, or the exact 6-digit string if valid.
   */
  static normalizePincode(value: any): { pincode: string | null; isValid: boolean; reason?: string } {
    if (value === null || value === undefined || value === '') {
      return { pincode: null, isValid: false, reason: 'Pincode is missing or empty' };
    }
    const raw = String(value).trim().replace(/\.0+$/, '');
    if (!raw || raw === '-' || raw.toUpperCase() === 'NA' || raw.toUpperCase() === 'N/A' || raw.toUpperCase() === 'NULL') {
      return { pincode: null, isValid: false, reason: 'Pincode is empty or placeholder' };
    }
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(raw)) {
      return {
        pincode: raw,
        isValid: false,
        reason: `Invalid PIN code format (${raw}). Must be exactly 6 digits starting with 1-9 without decimals.`,
      };
    }
    return { pincode: raw, isValid: true };
  }
}
