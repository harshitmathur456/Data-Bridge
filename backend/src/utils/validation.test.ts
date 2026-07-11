import { describe, it, expect } from 'vitest';
import { sanitizeAndValidateRecord, sanitizeNewlines } from './validation';
import { heuristicMapRows } from '../services/geminiService';

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

  // 7. Junk placeholder validation
  describe('Junk placeholder rejection', () => {
    it('should treat "N/A", "none", "null", "-" as empty/blank', () => {
      const { record, skipped } = sanitizeAndValidateRecord({
        name: 'John Doe',
        email: 'N/A',
        mobile: 'none',
      });
      expect(skipped).toBe(true); // both email and phone became blank, so skipped
      expect(record).toBeNull();
    });

    it('should preserve record if at least one valid email exists despite other junk', () => {
      const { record, skipped } = sanitizeAndValidateRecord({
        name: 'John Doe',
        email: 'john@example.com',
        mobile: 'n/a',
      });
      expect(skipped).toBe(false);
      expect(record?.email).toBe('john@example.com');
      expect(record?.mobile_without_country_code).toBeUndefined();
    });
  });

  // 8. Emoji-robust crm_status validation
  describe('Emoji-robust crm_status validation', () => {
    it('should correctly map "GOOD LEAD 🔥🔥🔥"', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_status: 'GOOD LEAD 🔥🔥🔥',
      });
      expect(record?.crm_status).toBe('GOOD_LEAD_FOLLOW_UP');
    });

    it('should correctly map "sale done 🎉"', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_status: 'sale done 🎉',
      });
      expect(record?.crm_status).toBe('SALE_DONE');
    });
  });

  // 9. Email normalization
  describe('Email normalization', () => {
    it('should trim and lowercase emails', () => {
      const { record } = sanitizeAndValidateRecord({
        email: '  SPACED.EMAIL@EXAMPLE.COM ',
      });
      expect(record?.email).toBe('spaced.email@example.com');
    });
  });

  // 10. CSV Injection prevention (Formula Injection)
  describe('CSV Injection prevention', () => {
    it('should prepend a single quote to values starting with =, +, -, @', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        name: '=SUM(A1:A10)',
        company: '+Corp',
        crm_note: '-some notes',
        description: '@danger',
      });
      expect(record?.name).toBe("'=SUM(A1:A10)");
      expect(record?.company).toBe("'+Corp");
      expect(record?.crm_note).toBe("'-some notes");
      expect(record?.description).toBe("'@danger");
    });

    it('should not alter normal text', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        name: 'Normal Name',
      });
      expect(record?.name).toBe('Normal Name');
    });
  });

  // 11. Multiline / Newline sanitization
  describe('Multiline newline sanitization', () => {
    it('should replace actual \\n in crm_note with literal \\n text', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_note: 'Line one\nLine two\nLine three',
      });
      expect(record?.crm_note).toBe('Line one\\nLine two\\nLine three');
      expect(record?.crm_note).not.toContain('\n');
    });

    it('should replace \\r\\n (Windows newlines) with literal \\n text', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_note: 'First line\r\nSecond line\r\nThird line',
      });
      expect(record?.crm_note).toBe('First line\\nSecond line\\nThird line');
    });

    it('should replace lone \\r (old Mac newlines) with literal \\n text', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_note: 'Alpha\rBeta\rGamma',
      });
      expect(record?.crm_note).toBe('Alpha\\nBeta\\nGamma');
    });

    it('should sanitize newlines in description field', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        description: 'Desc line 1\nDesc line 2',
      });
      expect(record?.description).toBe('Desc line 1\\nDesc line 2');
    });

    it('should sanitize newlines in name field', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        name: 'John\nDoe',
      });
      expect(record?.name).toBe('John\\nDoe');
    });

    it('should leave text without newlines unchanged', () => {
      const { record } = sanitizeAndValidateRecord({
        email: 'test@example.com',
        crm_note: 'Simple note without any newlines',
      });
      expect(record?.crm_note).toBe('Simple note without any newlines');
    });
  });

  // 12. sanitizeNewlines helper unit tests
  describe('sanitizeNewlines helper', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizeNewlines('')).toBe('');
    });

    it('should convert \\n to literal \\n', () => {
      expect(sanitizeNewlines('a\nb')).toBe('a\\nb');
    });

    it('should convert \\r\\n to single literal \\n', () => {
      expect(sanitizeNewlines('a\r\nb')).toBe('a\\nb');
    });

    it('should convert \\r to literal \\n', () => {
      expect(sanitizeNewlines('a\rb')).toBe('a\\nb');
    });

    it('should handle mixed newline types', () => {
      expect(sanitizeNewlines('a\nb\r\nc\rd')).toBe('a\\nb\\nc\\nd');
    });
  });
});

describe('heuristicMapRows', () => {
  it('should map standard fields correctly and collect unmapped fields into crm_note', () => {
    const input = [
      {
        fullname: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        budget: '5000000',
        age: '35',
        requirements: '3BHK Flat',
      }
    ];

    const results = heuristicMapRows(input);
    expect(results).toHaveLength(1);

    const mapped = results[0];
    expect(mapped.name).toBe('John Doe');
    expect(mapped.email).toBe('john@example.com');
    expect(mapped.mobile_without_country_code).toBe('9876543210');
    expect(mapped.crm_note).toContain('budget: 5000000');
    expect(mapped.crm_note).toContain('age: 35');
    expect(mapped.crm_note).toContain('requirements: 3BHK Flat');
  });

  it('should handle rows with no unmapped fields gracefully', () => {
    const input = [
      {
        fullname: 'Jane Doe',
        email: 'jane@example.com',
        phone: '8765432109',
      }
    ];

    const results = heuristicMapRows(input);
    expect(results).toHaveLength(1);

    const mapped = results[0];
    expect(mapped.name).toBe('Jane Doe');
    expect(mapped.email).toBe('jane@example.com');
    expect(mapped.mobile_without_country_code).toBe('8765432109');
    expect(mapped.crm_note).toBeUndefined();
  });
});

