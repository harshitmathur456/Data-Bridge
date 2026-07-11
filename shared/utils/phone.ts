// Regex to extract possible phone numbers from a string
export function extractPhoneNumbers(text: string): string[] {
  const datePattern = /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
  if (datePattern.test(text)) return [];

  // Matches sequences of digits, optionally prefixed with +, allowing spaces, dashes, and parentheses
  const phoneRegex = /\+?[0-9\s\-()]{7,30}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(p => p.replace(/[\s\-()]/g, '')).filter(p => p.length >= 7);
}

/**
 * Resolves primary and extra phone numbers and splits the country code.
 */
export function resolvePhoneAndCountryCode(
  raw: Record<string, any>,
  cityVal: string,
  stateVal: string,
  countryVal: string
): {
  primaryMobile: string;
  countryCode?: string;
  extraMobiles: string[];
  invalidPhoneNote: string;
} {
  const phoneAliasKeys = [
    'mobile_without_country_code', 'mobile', 'phone', 'phones',
    'contact_number', 'whatsapp', 'mob', 'ph_no', 'ph',
    'telephone', 'cell', 'phone_number',
  ];
  
  let mobileRaw = '';
  for (const alias of phoneAliasKeys) {
    const val = String(raw[alias] || '').trim();
    if (val) {
      mobileRaw = val;
      break;
    }
  }

  // Emergency fallback: scan ALL keys for a phone-looking value
  if (!mobileRaw) {
    const phonePattern = /^[\+\s\-()0-9]{7,15}$/;
    const datePattern = /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
    for (const key of Object.keys(raw)) {
      const val = String(raw[key] || '').trim();
      // Must look like a phone and not already captured as email or date
      if (val && phonePattern.test(val) && !val.includes('@') && !datePattern.test(val)) {
        mobileRaw = val;
        break;
      }
    }
  }

  if (mobileRaw) {
    const datePattern = /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
    if (datePattern.test(mobileRaw)) {
      mobileRaw = '';
    }
  }

  let phones = extractPhoneNumbers(mobileRaw);
  if (phones.length === 0 && mobileRaw) {
    phones = [mobileRaw]; // preserve as-is if no digit-only pattern matched
  }

  let primaryMobile = phones[0] || '';
  const extraMobiles = phones.slice(1);

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
      const candidates: { cc: string; rest: string }[] = [];
      for (const ccLen of [3, 2, 1]) {
        const ccCandidate = rawTrimmed.match(new RegExp(`^(\\+\\d{${ccLen}})[\\s\\-]?`))?.[1];
        if (!ccCandidate) continue;
        const rest = rawTrimmed.replace(new RegExp(`^\\+\\d{${ccLen}}[\\s\\-]?`), '').replace(/\D/g, '');
        if (rest.length >= 7 && rest.length <= 15) {
          candidates.push({ cc: ccCandidate, rest });
        }
      }
      const best = candidates.find(c => c.rest.length === 10) ?? candidates[0];
      if (best) {
        countryCode = best.cc;
        primaryMobile = best.rest;
      }
    }
  } else {
    primaryMobile = primaryMobile.replace(/^\+\d{1,3}[\s\-]?/, '');
    const ccDigits = countryCode.replace('+', '');
    if (ccDigits && primaryMobile.startsWith(ccDigits)) {
      const remainder = primaryMobile.slice(ccDigits.length);
      if (remainder.length >= 7 && remainder.length <= 15) {
        if (ccDigits === '91' && remainder.length === 10) {
          primaryMobile = remainder;
        } else if (ccDigits !== '91') {
          primaryMobile = remainder;
        }
      }
    }
  }

  primaryMobile = primaryMobile.replace(/\D/g, '');

  let invalidPhoneNote = '';
  if (primaryMobile && !/^\d{7,15}$/.test(primaryMobile)) {
    invalidPhoneNote = `invalid phone: ${mobileRaw}`;
    primaryMobile = '';
  }

  if (!countryCode && primaryMobile) {
    const indianKeywords = ['india', 'mumbai', 'bangalore', 'bengaluru', 'delhi', 'pune', 'ahmedabad', 'chennai', 'kolkata', 'hyderabad', 'maharashtra', 'karnataka', 'gujarat', 'tamil nadu', 'west bengal', 'telangana', 'ncr', 'gurgaon', 'noida'];
    const locationStr = `${cityVal} ${stateVal} ${countryVal}`.toLowerCase();
    if (indianKeywords.some(k => locationStr.includes(k))) {
      countryCode = '+91';
    }
  }

  return {
    primaryMobile,
    countryCode: countryCode || undefined,
    extraMobiles,
    invalidPhoneNote
  };
}
