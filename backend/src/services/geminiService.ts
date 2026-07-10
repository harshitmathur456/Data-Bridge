import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RawRow {
  [key: string]: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing normalizer
// Gemini sometimes outputs field names that differ from our exact schema keys
// (e.g. "phone" instead of "mobile_without_country_code", "loc_city" vs "city").
// This function maps every Gemini output row onto the canonical schema keys.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeGeminiRow(raw: any, originalRow: RawRow): any {
  if (!raw || typeof raw !== 'object') return raw;
  const out: any = { ...raw };

  // ── Phone ────────────────────────────────────────────────────────────────
  if (!out.mobile_without_country_code || out.mobile_without_country_code === '') {
    // Check known alias keys Gemini might emit
    const phoneAliases = [
      'phone', 'mobile', 'contact_number', 'contact', 'phone_number',
      'whatsapp', 'mob', 'ph_no', 'ph', 'telephone', 'cell',
    ];
    for (const alias of phoneAliases) {
      if (raw[alias] && String(raw[alias]).trim()) {
        out.mobile_without_country_code = String(raw[alias]).trim();
        break;
      }
    }
  }

  // If still missing — scan the original CSV row for any phone-like value
  if (!out.mobile_without_country_code || out.mobile_without_country_code === '') {
    const phonePattern = /^[\+\s\-()0-9]{7,15}$/;
    for (const key of Object.keys(originalRow)) {
      const val = String(originalRow[key] || '').trim();
      if (val && phonePattern.test(val) && !/\d{4}-\d{2}-\d{2}/.test(val)) {
        // Looks like a phone, not a date
        out.mobile_without_country_code = val;
        break;
      }
    }
  }

  // ── City ─────────────────────────────────────────────────────────────────
  if (!out.city || out.city === '') {
    const cityAliases = ['location', 'loc_city', 'location_city', 'loc', 'area', 'place', 'town'];
    for (const alias of cityAliases) {
      if (raw[alias] && String(raw[alias]).trim()) {
        out.city = String(raw[alias]).trim();
        break;
      }
    }
    // Scan original row for city alias keys
    if (!out.city) {
      for (const key of Object.keys(originalRow)) {
        if (/city|town|area|loc/i.test(key) && originalRow[key]?.trim()) {
          out.city = originalRow[key].trim();
          break;
        }
      }
    }
  }

  // ── State ────────────────────────────────────────────────────────────────
  if (!out.state || out.state === '') {
    const stateAliases = ['province', 'region', 'loc_state'];
    for (const alias of stateAliases) {
      if (raw[alias] && String(raw[alias]).trim()) {
        out.state = String(raw[alias]).trim();
        break;
      }
    }
  }

  // ── crm_status inference from free-text notes (post-Gemini safety net) ──
  if (!out.crm_status || out.crm_status === '') {
    const noteText = String(
      raw.crm_note || raw.note || raw.notes || raw.comments || raw.remark || ''
    ).toLowerCase();
    if (/deal\s*clos|onboard|payment\s*done|booking\s*done|sale\s*done|won/i.test(noteText)) {
      out.crm_status = 'SALE_DONE';
    } else if (/not\s*interest|no\s*longer\s*interest|junk|bad\s*lead/i.test(noteText)) {
      out.crm_status = 'BAD_LEAD';
    } else if (/no\s*response|could\s*not\s*reach|not\s*reachable|busy|dnc|did\s*not\s*connect/i.test(noteText)) {
      out.crm_status = 'DID_NOT_CONNECT';
    } else if (/hot\s*lead|follow.?up|interested|will\s*call|call\s*back/i.test(noteText)) {
      out.crm_status = 'GOOD_LEAD_FOLLOW_UP';
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic fallback mapper (runs when no API key or on Gemini failure)
// ─────────────────────────────────────────────────────────────────────────────
export function heuristicMapRows(rows: RawRow[]): any[] {
  console.log('[Mock AI] Using heuristic mapping fallback');
  return rows.map(row => {
    const result: any = {};
    const keys = Object.keys(row);

    // ── Name ──
    const nameKey = keys.find(k => /\bname\b|full.?name|lead.?name|customer.?name/i.test(k));
    if (nameKey) result.name = row[nameKey];
    // Handle split first+last
    const firstKey = keys.find(k => /\bfirst.?name\b/i.test(k));
    const lastKey  = keys.find(k => /\blast.?name\b/i.test(k));
    if (!result.name && firstKey) result.name = [row[firstKey], lastKey ? row[lastKey] : ''].filter(Boolean).join(' ').trim();

    // ── Email ──
    const emailKey = keys.find(k => /\bemail\b|\bmail\b|e-?mail/i.test(k));
    if (emailKey) result.email = row[emailKey];

    // ── Phone — wide net ──
    const phoneKey = keys.find(k =>
      /\bphone\b|\bmobile\b|\bcontact\b|\bph\b|\bnum\b|\bwhatsapp\b|\btelephone\b|\bcell\b|\bph.?no\b/i.test(k)
    );
    if (phoneKey) {
      result.mobile_without_country_code = row[phoneKey];
    } else {
      // Value-based fallback: scan for phone-like values
      const phonePattern = /^[\+\s\-()0-9]{7,15}$/;
      for (const k of keys) {
        const v = String(row[k] || '').trim();
        if (v && phonePattern.test(v) && !/\d{4}-\d{2}-\d{2}/.test(v) && !result.email?.includes(v)) {
          result.mobile_without_country_code = v;
          break;
        }
      }
    }

    // ── Date ──
    const dateKey = keys.find(k => /\bdate\b|\btime\b|\bcreated\b|created_?at/i.test(k));
    if (dateKey) result.created_at = row[dateKey];

    // ── Company ──
    const companyKey = keys.find(k => /\bcompany\b|\borg\b|\bbusiness\b|\bbiz\b/i.test(k));
    if (companyKey) result.company = row[companyKey];

    // ── City — wide net (includes location_city, loc_city, area, etc.) ──
    const cityKey = keys.find(k => /\bcity\b|\btown\b|\barea\b|\bloc\b|location/i.test(k));
    if (cityKey) result.city = row[cityKey];

    // ── State ──
    const stateKey = keys.find(k => /\bstate\b|\bprovince\b|\bregion\b/i.test(k));
    if (stateKey) result.state = row[stateKey];

    // ── Country ──
    const countryKey = keys.find(k => /\bcountry\b/i.test(k));
    if (countryKey) result.country = row[countryKey];

    // ── Status — infer from value text (status/stage column + note/remark/comment column) ──
    const statusKey = keys.find(k => /\bstatus\b|\bstage\b|\bdisposition\b/i.test(k));
    const noteKey   = keys.find(k => /\bnote\b|\bnotes\b|\bremark\b|\bremarks\b|\bcomment\b|\bcomments\b/i.test(k));
    const signalText = [
      statusKey ? row[statusKey] : '',
      noteKey   ? row[noteKey]   : '',
    ].join(' ').toLowerCase();

    if (/deal\s*clos|onboard|payment\s*done|booking\s*done|sale\s*done|won/i.test(signalText)) {
      result.crm_status = 'SALE_DONE';
    } else if (/not\s*interest|no\s*longer\s*interest|junk|bad\s*lead/i.test(signalText)) {
      result.crm_status = 'BAD_LEAD';
    } else if (/no\s*response|could\s*not\s*reach|not\s*reachable|busy|dnc/i.test(signalText)) {
      result.crm_status = 'DID_NOT_CONNECT';
    } else if (/good|follow.?up|interested|hot\s*lead|will\s*call|call\s*back/i.test(signalText)) {
      result.crm_status = 'GOOD_LEAD_FOLLOW_UP';
    }

    // ── Source ──
    const sourceKey = keys.find(k => /\bsource\b/i.test(k));
    if (sourceKey) {
      const sv = String(row[sourceKey]).toLowerCase();
      if (sv.includes('demand') || sv.includes('lead')) result.data_source = 'leads_on_demand';
      else if (sv.includes('meridian') || sv.includes('tower')) result.data_source = 'meridian_tower';
      else if (sv.includes('eden')    || sv.includes('park'))  result.data_source = 'eden_park';
      else if (sv.includes('varah')   || sv.includes('swamy')) result.data_source = 'varah_swamy';
      else if (sv.includes('sarjapur')|| sv.includes('plot'))  result.data_source = 'sarjapur_plots';
    }

    // ── Note / Description ──
    if (noteKey) result.crm_note = row[noteKey];
    const descKey = keys.find(k => /\bdesc\b|\bdescription\b/i.test(k));
    if (descKey) result.description = row[descKey];

    const possKey = keys.find(k => /\bpossession\b/i.test(k));
    if (possKey) result.possession_time = row[possKey];

    return result;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt (v2 — fixes phone, city, skip, status inference)
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a CRM data extraction engine. You will receive a batch of CSV rows as JSON objects with arbitrary column names. Map each row into this EXACT CRM schema:

created_at, name, email, country_code, mobile_without_country_code, company, city, state, country, lead_owner, crm_status, crm_note, data_source, possession_time, description

RULES:
1. Column names are NOT fixed. Infer meaning from header text AND cell content (e.g. a column named "Ph No", "Contact Number", "Whatsapp", "Mobile" etc. all map to mobile_without_country_code — a value that looks like a phone number, even under an unexpected header, must still be extracted).
2. Extract phone numbers: strip spaces, dashes, parentheses. Keep only digits for mobile_without_country_code. If country code is present (e.g. +91), put it in country_code separately.
3. Extract city/state/country similarly — match by header meaning first, then by value pattern (known Indian city/state names) if header is ambiguous.
4. created_at: convert any date format (DD-MM-YYYY, MM/DD/YYYY, "14 May 2026", ISO, etc.) into "YYYY-MM-DD HH:mm:ss". Never leave a parseable date blank.
5. crm_status — map to ONE of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE. Infer confidently from notes/comments/stage columns even if the exact enum word is not used:
   - "deal closed", "onboarding started", "payment done", "booking confirmed" → SALE_DONE
   - "not interested", "no longer interested", "junk" → BAD_LEAD
   - "will call back", "interested", "hot lead", "follow up" → GOOD_LEAD_FOLLOW_UP
   - "no response", "could not reach", "busy", "DNC" → DID_NOT_CONNECT
   - Only leave blank if there is truly NO signal at all.
6. data_source — map to ONE of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. Leave blank if no confident match.
7. Multiple emails/phones in one field: use the first as the primary value, append all additional ones into crm_note prefixed clearly (e.g. "Alt phone: 9876500000").
8. SKIP a record ONLY if it has NEITHER a valid email NOR a valid phone number after extraction. If at least one of these two is present, the record MUST be imported — never skip it for any other reason.
9. Return strict JSON array only. No markdown, no commentary, no code fences.`;

// ─────────────────────────────────────────────────────────────────────────────
// Few-shot examples — covers phone-only, ambiguous city header, status inference
// ─────────────────────────────────────────────────────────────────────────────
const FEW_SHOT_EXAMPLES = `
Example input:
[
  {
    "date": "2026-05-13 14:20:48",
    "fullname": "Priya Singh",
    "email_addr": "priya.singh@example.com",
    "ph": "+91 9876543210",
    "biz_name": "GrowEasy",
    "location_city": "Mumbai",
    "loc_state": "Maharashtra",
    "loc_country": "India",
    "comment": "Deal closed, onboarding started",
    "source_val": "eden_park"
  },
  {
    "entry_date": "14 May 2026",
    "contact_person": "Rajesh Patel",
    "whatsapp": "8800012345",
    "company_name": "ABC Realty",
    "area": "Bangalore",
    "remarks": "Interested, will call back"
  }
]

Example output:
[
  {
    "created_at": "2026-05-13 14:20:48",
    "name": "Priya Singh",
    "email": "priya.singh@example.com",
    "country_code": "+91",
    "mobile_without_country_code": "9876543210",
    "company": "GrowEasy",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "crm_status": "SALE_DONE",
    "crm_note": "Deal closed, onboarding started",
    "data_source": "eden_park"
  },
  {
    "created_at": "2026-05-14 00:00:00",
    "name": "Rajesh Patel",
    "email": "",
    "mobile_without_country_code": "8800012345",
    "company": "ABC Realty",
    "city": "Bangalore",
    "crm_status": "GOOD_LEAD_FOLLOW_UP",
    "crm_note": "Interested, will call back"
  }
]
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export async function mapBatchWithGemini(rows: RawRow[]): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    return heuristicMapRows(rows);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `Please map the following records into the target CRM schema.
Here are few-shot examples:
${FEW_SHOT_EXAMPLES}

Input Records:
${JSON.stringify(rows, null, 2)}

Return the mapped output strictly as a JSON array. No markdown, no code fences, just raw JSON.`;

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const text = response.response.text();
    if (!text) throw new Error('Empty response from Gemini API');

    let parsed = JSON.parse(text.trim());

    // Unwrap if Gemini wrapped output in an object key
    if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
      const innerKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
      parsed = innerKey ? parsed[innerKey] : [parsed];
    }

    if (!Array.isArray(parsed)) throw new Error('Gemini output is not a JSON array');

    // Post-process: normalize field aliases + fill gaps from original rows
    return (parsed as any[]).map((geminiRow, idx) =>
      normalizeGeminiRow(geminiRow, rows[idx] ?? {})
    );

  } catch (error: any) {
    console.error('[Gemini Service Error]', error.message || error);
    // Graceful fallback so users always get results
    return heuristicMapRows(rows);
  }
}
