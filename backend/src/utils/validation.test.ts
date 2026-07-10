import { describe, it, expect } from 'vitest';
import { sanitizeAndValidateRecord } from './validation';

describe('sanitizeAndValidateRecord', () => {
  // 1. Skip logic: record with no email AND no phone → should be marked as skipped.
  // Record with only email OR only phone → should be imported.
  describe('Skip logic', () => {
    it('should skip record with no email AND no phone', () => {
      const { record, skipped, reason } = sanitizeAndValidateRecord({
        name: 'Ghost Lead',
        company: 'Nowhere Inc',
      });
      expect(skipped).toBe(true);
      expect(record).toBeNull();
      expect(reason).toContain('Missing both email and phone number');
    });

    it('should import record with only email', () => {
      const { record, skipped } = sanitizeAndValidateRecord({
        name: 'Email Only',
        email: 'email@example.com',
      });
      expect(skipped).toBe(false);
      expect(record).not.toBeNull();
      expect(record?.email).toBe('email@example.com');
      expect(record?.mobile_without_country_code).toBeUndefined();
    });

    it('should import record with only phone', () => {
      const { record, skipped } = sanitizeAndValidateRecord({
        name: 'Phone Only',
        mobile: '9876543210',
      });
      expect(skipped).toBe(false);
      expect(record).not.toBeNull();
      expect(record?.mobile_without_country_code).toBe('9876543210');
      expect(record?.email).toBe('');
    });
  });

  // 2. crm_status validation: allowed 4 values, others to blank/null
  describe('crm_status validation', () => {
    const validStatuses = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE'];
    
    validStatuses.forEach(status => {
      it(`should allow valid crm_status: ${status}`, () => {
        const { record } = sanitizeAndValidateRecord({
          email: 'test@example.com',
          crm_status: status,
        });
        expect(record?.crm_status).toBe(status);
      });
    });

    it('should convert invalid crm_status to blank/empty string', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_status: 'INVALID_STATUS_VALUE',
      });
      expect(record?.crm_status).toBe('');
    });
  });

  // 3. data_source validation: allowed 5 values, others to blank
  describe('data_source validation', () => {
    const validSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
    
    validSources.forEach(source => {
      it(`should allow valid data_source: ${source}`, () => {
        const { record } = sanitizeAndValidateRecord({
          email: 'test@example.com',
          data_source: source,
        });
        expect(record?.data_source).toBe(source);
      });
    });

    it('should convert invalid data_source to blank/empty string', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        data_source: 'INVALID_SOURCE_VALUE',
      });
      expect(record?.data_source).toBe('');
    });
  });

  // 4. Multiple contact handling: first primary, rest in crm_note
  describe('Multiple contact handling', () => {
    it('should put first email in primary and rest in crm_note', () => {
      const { record } = sanitizeAndValidateRecord({
        name: 'Multi Email',
        email: 'first@test.com, second@test.com, third@test.com',
      });
      expect(record?.email).toBe('first@test.com');
      expect(record?.crm_note).toContain('Extra Emails: second@test.com, third@test.com');
    });

    it('should put first phone in primary and rest in crm_note', () => {
      const { record } = sanitizeAndValidateRecord({
        name: 'Multi Phone',
        mobile: '9876543210, 9988776655, 9112233445',
      });
      expect(record?.mobile_without_country_code).toBe('9876543210');
      expect(record?.crm_note).toContain('Extra Mobiles: 9988776655, 9112233445');
    });
  });

  // 5. Country code + phone splitting
  describe('Country code + phone splitting', () => {
    it('should split with + prefix: +91 9988776655', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '+91 9988776655',
      });
      expect(record?.country_code).toBe('+91');
      expect(record?.mobile_without_country_code).toBe('9988776655');
    });

    it('should split with 00 prefix: 0091-9876543221', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '0091-9876543221',
      });
      expect(record?.country_code).toBe('+91');
      expect(record?.mobile_without_country_code).toBe('9876543221');
    });

    it('should split with no separator: 919876543222', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '919876543222',
      });
      expect(record?.country_code).toBe('+91');
      expect(record?.mobile_without_country_code).toBe('9876543222');
    });

    it('should split leading country code with spaces: 44 7911 123456', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '44 7911 123456',
      });
      expect(record?.country_code).toBe('+44');
      expect(record?.mobile_without_country_code).toBe('7911123456');
    });

    it('should handle formatting characters (parentheses, dashes) correctly: +1 (415) 555-0198', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '+1 (415) 555-0198',
      });
      expect(record?.country_code).toBe('+1');
      expect(record?.mobile_without_country_code).toBe('4155550198');
    });

    it('should reject date-like pattern as phone number: 16-05-2026', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '16-05-2026',
      });
      expect(record?.mobile_without_country_code).toBeUndefined();
    });

    it('should reject date-like pattern with slashes: 01/02/2026', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        mobile: '01/02/2026',
      });
      expect(record?.mobile_without_country_code).toBeUndefined();
    });
  });

  // 6. Date validation: created_at format or fallback
  describe('Date validation', () => {
    it('should parse valid date successfully', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        created_at: '2026-05-14T10:30:00Z',
      });
      expect(record?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should fallback to current date for invalid date', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        created_at: 'NOT_A_VALID_DATE',
      });
      expect(record?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });
});
