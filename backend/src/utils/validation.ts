import { z } from 'zod';

export interface CRMRecord {
  created_at?: string;
  name?: string;
  email?: string;
  country_code?: string;
  mobile_without_country_code?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  lead_owner?: string;
  crm_status?: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE' | '';
  crm_note?: string;
  data_source?: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | '';
  possession_time?: string;
  description?: string;
}

const ALLOWED_CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE'
] as const;

const ALLOWED_DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots'
] as const;

// Helper to format Date into YYYY-MM-DD HH:mm:ss
export function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// Regex to extract emails from a string
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

// Regex to extract possible phone numbers from a string
function extractPhoneNumbers(text: string): string[] {
  // Matches sequences of digits, optionally prefixed with +, allowing spaces and dashes
  const phoneRegex = /\+?[0-9\s\-]{7,25}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(p => p.replace(/[\s\-]/g, '')).filter(p => p.length >= 7);
}

export function sanitizeAndValidateRecord(raw: any): { record: CRMRecord | null; skipped: boolean; reason?: string } {
  if (!raw || typeof raw !== 'object') {
    return { record: null, skipped: true, reason: 'Invalid record format' };
  }

  // 1. Resolve and extract emails
  let emailRaw = String(raw.email || raw.emails || '').trim();
  let emails = extractEmails(emailRaw);
  
  // If the email field didn't contain emails, search description or note as backup or check if they are in raw.email
  if (emails.length === 0 && emailRaw) {
    emails = [emailRaw]; // fallback
  }

  const primaryEmail = emails[0] || '';
  const extraEmails = emails.slice(1);

  // 2. Resolve and extract phone/mobile — check many possible alias keys
  // NOTE: 'contact' is intentionally excluded — it would match 'Contact Email'.
  const phoneAliasKeys = [
    'mobile_without_country_code', 'mobile', 'phone', 'phones',
    'contact_number', 'whatsapp', 'mob', 'ph_no', 'ph',
    'telephone', 'cell', 'phone_number',
  ];
  let mobileRaw = '';
  for (const alias of phoneAliasKeys) {
    const val = String(raw[alias] || '').trim();
    if (val) { mobileRaw = val; break; }
  }

  // Emergency fallback: scan ALL keys for a phone-looking value
  if (!mobileRaw) {
    const phonePattern = /^[\+\s\-()0-9]{7,15}$/;
    for (const key of Object.keys(raw)) {
      const val = String(raw[key] || '').trim();
      // Must look like a phone and not already captured as email or date
      if (val && phonePattern.test(val) && !val.includes('@') && !/\d{4}-\d{2}-\d{2}/.test(val)) {
        mobileRaw = val;
        break;
      }
    }
  }

  let phones = extractPhoneNumbers(mobileRaw);
  if (phones.length === 0 && mobileRaw) {
    phones = [mobileRaw]; // preserve as-is if no digit-only pattern matched
  }

  let primaryMobile = phones[0] || '';
  const extraMobiles = phones.slice(1);

  // Detect and split country code BEFORE further digit stripping.
  // Strategy: try extracting 1-, 2-, 3-digit codes and pick the longest CC
  // that still leaves a plausible phone (7–15 digits).  This prevents
  // "+919876543210" being mis-parsed as CC="+919" instead of CC="+91".
  let countryCode = String(raw.country_code || '').trim();

  // Normalize "00" prefix to "+"
  if (primaryMobile.startsWith('00')) {
    primaryMobile = '+' + primaryMobile.slice(2);
  }

  // Ensure countryCode always has a leading '+' if it consists of digits
  if (countryCode && /^\d+$/.test(countryCode)) {
    countryCode = '+' + countryCode;
  }

  // If no explicit CC was parsed but we have a raw unformatted number, try to extract it
  if (!countryCode && /^\d{10,13}$/.test(primaryMobile.replace(/\D/g, ''))) {
    const digitsOnly = primaryMobile.replace(/\D/g, '');
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) { countryCode = '+91'; primaryMobile = digitsOnly.slice(2); }
    else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) { countryCode = '+1'; primaryMobile = digitsOnly.slice(1); }
    else if (digitsOnly.length === 12 && digitsOnly.startsWith('44')) { countryCode = '+44'; primaryMobile = digitsOnly.slice(2); }
    else if (digitsOnly.length === 13 && digitsOnly.startsWith('86')) { countryCode = '+86'; primaryMobile = digitsOnly.slice(2); }
    else if (digitsOnly.length === 10 && digitsOnly.startsWith('65')) { countryCode = '+65'; primaryMobile = digitsOnly.slice(2); }
  }

  if (!countryCode) {
    const rawTrimmed = primaryMobile.trim();
    if (rawTrimmed.startsWith('+')) {
      // Collect all valid CC candidates (1–3 digit codes)
      // then prefer the one whose remaining digits = 10 (most common mobile length).
      const candidates: { cc: string; rest: string }[] = [];
      for (const ccLen of [3, 2, 1]) {
        const ccCandidate = rawTrimmed.match(new RegExp(`^(\\+\\d{${ccLen}})[\\s\\-]?`))?.[1];
        if (!ccCandidate) continue;
        const rest = rawTrimmed.replace(new RegExp(`^\\+\\d{${ccLen}}[\\s\\-]?`), '').replace(/\D/g, '');
        if (rest.length >= 7 && rest.length <= 15) {
          candidates.push({ cc: ccCandidate, rest });
        }
      }
      // Prefer 10-digit remainder (global standard); else take first valid
      const best = candidates.find(c => c.rest.length === 10) ?? candidates[0];
      if (best) {
        countryCode = best.cc;
        primaryMobile = best.rest;
      }
    }
  } else {
    // country_code provided separately — ensure mobile doesn't contain it
    // Strip any leading +digits
    primaryMobile = primaryMobile.replace(/^\+\d{1,3}[\s\-]?/, '');
    
    // Check if the CC digits leaked into the mobile number without a plus (e.g. LLM returned "91" and "919988776655")
    const ccDigits = countryCode.replace('+', '');
    if (ccDigits && primaryMobile.startsWith(ccDigits)) {
      const remainder = primaryMobile.slice(ccDigits.length);
      // Only strip if the remaining part looks like a valid phone length (e.g., >= 7 digits)
      // This prevents stripping if the actual mobile number coincidentally starts with those digits
      if (remainder.length >= 7 && remainder.length <= 15) {
        // As a heuristic for India, prefer 10 digit remainders if CC is 91
        if (ccDigits === '91' && remainder.length === 10) {
          primaryMobile = remainder;
        } else if (ccDigits !== '91') {
          primaryMobile = remainder;
        }
      }
    }
  }

  // Keep only digits in the final mobile value
  primaryMobile = primaryMobile.replace(/\D/g, '');

  // Phone validity: must be 7–15 digits after cleaning.
  // If shorter (e.g. "98765XXXXX" → "98765"), flag as invalid and discard.
  let invalidPhoneNote = '';
  if (primaryMobile && !/^\d{7,15}$/.test(primaryMobile)) {
    invalidPhoneNote = `invalid phone: ${mobileRaw}`;
    primaryMobile = ''; // do not save a broken number to CRM
  }

  // Infer country_code +91 if missing, but location indicates India
  if (!countryCode && primaryMobile) {
    const indianKeywords = ['india', 'mumbai', 'bangalore', 'bengaluru', 'delhi', 'pune', 'ahmedabad', 'chennai', 'kolkata', 'hyderabad', 'maharashtra', 'karnataka', 'gujarat', 'tamil nadu', 'west bengal', 'telangana', 'ncr', 'gurgaon', 'noida'];
    const locationStr = `${raw.city || ''} ${raw.state || ''} ${raw.country || ''}`.toLowerCase();
    if (indianKeywords.some(k => locationStr.includes(k))) {
      countryCode = '+91';
    }
  }

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
  let crmStatus: any = '';
  if (raw.crm_status) {
    const normalizedStatus = String(raw.crm_status).toUpperCase().replace(/[\s-]/g, '_');
    const matchedStatus = ALLOWED_CRM_STATUSES.find(s => s === normalizedStatus);
    if (matchedStatus) {
      crmStatus = matchedStatus;
    }
  }

  let dataSource: any = '';
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

  const crmRecord: CRMRecord = {
    created_at: createdAtStr,
    name: String(raw.name || raw.lead_name || raw.customer_name || raw.contact_person || '').trim(),
    email: primaryEmail,
    country_code: countryCode || undefined,
    mobile_without_country_code: primaryMobile || undefined,
    company: String(raw.company || raw.company_name || '').trim(),
    city: cityVal,
    state: String(raw.state || raw.province || raw.loc_state || '').trim(),
    country: String(raw.country || '').trim(),
    lead_owner: String(raw.lead_owner || '').trim(),
    crm_status: crmStatus,
    crm_note: finalCrmNote || undefined,
    data_source: dataSource,
    possession_time: String(raw.possession_time || '').trim(),
    description: String(raw.description || '').trim()
  };

  return { record: crmRecord, skipped: false };
}
