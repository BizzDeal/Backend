import { ExcelValueNormalizer } from './excel-value-normalizer';

describe('ExcelValueNormalizer', () => {
  describe('normalizeCode', () => {
    it('should trim and remove trailing .0 from numeric excel code conversions', () => {
      expect(ExcelValueNormalizer.normalizeCode(35)).toBe('35');
      expect(ExcelValueNormalizer.normalizeCode('35.0')).toBe('35');
      expect(ExcelValueNormalizer.normalizeCode(' 744101.00 ')).toBe('744101');
    });

    it('should return null for placeholders or empty values', () => {
      expect(ExcelValueNormalizer.normalizeCode('')).toBeNull();
      expect(ExcelValueNormalizer.normalizeCode('-')).toBeNull();
      expect(ExcelValueNormalizer.normalizeCode('NA')).toBeNull();
      expect(ExcelValueNormalizer.normalizeCode('null')).toBeNull();
    });
  });

  describe('normalizePincode', () => {
    it('should accept valid 6-digit Indian PIN codes', () => {
      const res = ExcelValueNormalizer.normalizePincode('744101');
      expect(res.isValid).toBe(true);
      expect(res.pincode).toBe('744101');
    });

    it('should reject PIN codes starting with 0 or not exactly 6 digits', () => {
      expect(ExcelValueNormalizer.normalizePincode('044101').isValid).toBe(false);
      expect(ExcelValueNormalizer.normalizePincode('74410').isValid).toBe(false);
      expect(ExcelValueNormalizer.normalizePincode('7441012').isValid).toBe(false);
    });
  });
});
