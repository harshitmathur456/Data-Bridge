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
  // Matches sequences of 7 to 15 digits, optionally prefixed with +
  const phoneRegex = /\+?[0-9-]{7,15}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(p => p.replace(/[-]/g, '')).filter(p => p.length >= 7);
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

  // 2. Resolve and extract phone/mobile
  let mobileRaw = String(raw.mobile_without_country_code || raw.mobile || raw.phone || raw.phones || '').trim();
  let phones = extractPhoneNumbers(mobileRaw);
  if (phones.length === 0 && mobileRaw) {
    phones = [mobileRaw]; // fallback
  }

  let primaryMobile = phones[0] || '';
  const extraMobiles = phones.slice(1);

  // Separate country code from primary mobile if prefix "+" exists
  let countryCode = String(raw.country_code || '').trim();
  if (primaryMobile.startsWith('+')) {
    // If country code is empty, extract it from mobile
    if (!countryCode) {
      if (primaryMobile.startsWith('+91')) {
        countryCode = '+91';
        primaryMobile = primaryMobile.replace('+91', '');
      } else {
        // Generic extraction (e.g. first 3 chars)
        const match = primaryMobile.match(/^(\+\d{1,3})/);
        if (match) {
          countryCode = match[1];
          primaryMobile = primaryMobile.replace(countryCode, '');
        }
      }
    } else {
      primaryMobile = primaryMobile.replace(/^\+\d+/, '');
    }
  }
  
  // Clean up primary mobile to contain only digits
  primaryMobile = primaryMobile.replace(/\D/g, '');

  // 3. Skip check: must have email OR mobile
  if (!primaryEmail && !primaryMobile) {
    return { record: null, skipped: true, reason: 'Missing email and mobile number' };
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

  // 6. Build crm_note and capture extra details
  const notesList: string[] = [];
  
  // Add original comments/notes/remarks
  const originalNote = String(raw.crm_note || raw.note || raw.notes || raw.remarks || '').trim();
  if (originalNote) {
    notesList.push(originalNote);
  }

  // Append extra emails
  if (extraEmails.length > 0) {
    notesList.push(`Extra Emails: ${extraEmails.join(', ')}`);
  }

  // Append extra mobiles
  if (extraMobiles.length > 0) {
    notesList.push(`Extra Mobiles: ${extraMobiles.join(', ')}`);
  }

  const finalCrmNote = notesList.join(' | ');

  const crmRecord: CRMRecord = {
    created_at: createdAtStr,
    name: String(raw.name || raw.lead_name || raw.customer_name || '').trim(),
    email: primaryEmail,
    country_code: countryCode || undefined,
    mobile_without_country_code: primaryMobile || undefined,
    company: String(raw.company || raw.company_name || '').trim(),
    city: String(raw.city || '').trim(),
    state: String(raw.state || '').trim(),
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
