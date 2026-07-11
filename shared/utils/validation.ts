import { CRMRecord, CRMStatus, DataSource, RawRow } from '../types';
import { ALLOWED_CRM_STATUSES, ALLOWED_DATA_SOURCES } from '../constants';
import { resolvePhoneAndCountryCode } from './phone';
import { resolveEmails } from './email';
import { cleanJunk, sanitizeFormulaInjection, sanitizeNewlines } from './sanitizers';
import { formatDate } from './formatters';

// Export sanitizers to maintain API compatibility for test cases
export { sanitizeNewlines } from './sanitizers';

export function sanitizeAndValidateRecord(raw: RawRow): { record: CRMRecord | null; skipped: boolean; reason?: string } {
  if (!raw || typeof raw !== 'object') {
    return { record: null, skipped: true, reason: 'Invalid record format' };
  }

  // Pre-process raw object to clean junk placeholders
  const cleanRaw: RawRow = {};
  for (const key of Object.keys(raw)) {
    const val = raw[key];
    if (typeof val === 'string') {
      cleanRaw[key] = cleanJunk(val);
    } else {
      cleanRaw[key] = val;
    }
  }
  raw = cleanRaw;

  // City — check alias keys as well
  const cityAliasKeys = ['city', 'location', 'loc_city', 'location_city', 'loc', 'area', 'place', 'town'];
  let cityVal = '';
  for (const alias of cityAliasKeys) {
    const v = String(raw[alias] || '').trim();
    if (v) { cityVal = v; break; }
  }
  // Fallback: scan raw keys for city-like headers
  if (!cityVal) {
    for (const key of Object.keys(raw)) {
      if (/city|town|area|\bloc\b|location/i.test(key) && raw[key]?.trim()) {
        cityVal = raw[key].trim();
        break;
      }
    }
  }

  const stateVal = String(raw.state || raw.province || raw.loc_state || '').trim();
  const countryVal = String(raw.country || '').trim();

  // 1. Resolve and extract emails
  const { primaryEmail, extraEmails } = resolveEmails(String(raw.email || raw.emails || ''));

  // 2. Resolve and extract phone/mobile and split country code
  const { 
    primaryMobile, 
    countryCode, 
    extraMobiles, 
    invalidPhoneNote 
  } = resolvePhoneAndCountryCode(raw, cityVal, stateVal, countryVal);

  // 3. Skip check: ONLY skip when BOTH email AND phone are absent
  if (!primaryEmail && !primaryMobile) {
    return { record: null, skipped: true, reason: 'Missing both email and phone number' };
  }

  // 4. Date validation
  let createdAtStr = formatDate(new Date());
  if (raw.created_at) {
    const parsedDate = Date.parse(raw.created_at);
    if (!isNaN(parsedDate)) {
      createdAtStr = formatDate(new Date(parsedDate));
    }
  }

  // 5. Enum clamping
  let crmStatus: CRMStatus = '';
  if (raw.crm_status) {
    const rawStatus = String(raw.crm_status).toUpperCase();
    if (rawStatus.includes('GOOD_LEAD') || rawStatus.includes('FOLLOW_UP') || rawStatus.includes('GOOD')) {
      crmStatus = 'GOOD_LEAD_FOLLOW_UP';
    } else if (rawStatus.includes('DID_NOT_CONNECT') || rawStatus.includes('CONNECT')) {
      crmStatus = 'DID_NOT_CONNECT';
    } else if (rawStatus.includes('BAD_LEAD') || rawStatus.includes('BAD')) {
      crmStatus = 'BAD_LEAD';
    } else if (rawStatus.includes('SALE_DONE') || rawStatus.includes('SALE')) {
      crmStatus = 'SALE_DONE';
    } else {
      const normalizedStatus = rawStatus.replace(/[^A-Z0-9_]/g, '');
      const matchedStatus = ALLOWED_CRM_STATUSES.find(s => s.replace(/_/g, '') === normalizedStatus);
      if (matchedStatus) {
        crmStatus = matchedStatus;
      }
    }
  }

  let dataSource: DataSource = '';
  if (raw.data_source) {
    const normalizedSource = String(raw.data_source).toLowerCase().replace(/[\s-]/g, '_');
    const matchedSource = ALLOWED_DATA_SOURCES.find(s => s === normalizedSource);
    if (matchedSource) {
      dataSource = matchedSource;
    }
  }

  // 6. Build crm_note — original note + invalid phone flag + extra emails/mobiles
  const notesList: string[] = [];

  const originalNote = String(raw.crm_note || raw.note || raw.notes || raw.remarks || '').trim();
  if (originalNote) notesList.push(originalNote);

  // Invalid phone: save raw value for reference so data is not silently lost
  if (invalidPhoneNote) notesList.push(invalidPhoneNote);

  if (extraEmails.length  > 0) notesList.push(`Extra Emails: ${extraEmails.join(', ')}`);
  if (extraMobiles.length > 0) notesList.push(`Extra Mobiles: ${extraMobiles.join(', ')}`);

  const finalCrmNote = notesList.join(' | ');

  const crmRecord: CRMRecord = {
    created_at: createdAtStr,
    name: sanitizeNewlines(sanitizeFormulaInjection(String(raw.name || raw.lead_name || raw.customer_name || raw.contact_person || '').trim())),
    email: primaryEmail,
    country_code: countryCode || undefined,
    mobile_without_country_code: primaryMobile || undefined,
    company: sanitizeNewlines(sanitizeFormulaInjection(String(raw.company || raw.company_name || '').trim())),
    city: sanitizeNewlines(sanitizeFormulaInjection(cityVal)),
    state: sanitizeNewlines(sanitizeFormulaInjection(stateVal)),
    country: sanitizeNewlines(sanitizeFormulaInjection(countryVal)),
    lead_owner: sanitizeNewlines(sanitizeFormulaInjection(String(raw.lead_owner || '').trim())),
    crm_status: crmStatus,
    crm_note: finalCrmNote ? sanitizeNewlines(sanitizeFormulaInjection(finalCrmNote)) : undefined,
    data_source: dataSource,
    possession_time: sanitizeNewlines(sanitizeFormulaInjection(String(raw.possession_time || '').trim())),
    description: sanitizeNewlines(sanitizeFormulaInjection(String(raw.description || '').trim()))
  };

  return { record: crmRecord, skipped: false };
}
