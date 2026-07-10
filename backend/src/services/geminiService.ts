import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RawRow {
  [key: string]: string;
}

// Heuristic fallback mapper to make the application testable without an API key
export function heuristicMapRows(rows: RawRow[]): any[] {
  console.log('[Mock AI] Using heuristic mapping fallback');
  return rows.map(row => {
    const result: any = {};
    const keys = Object.keys(row);
    
    // Find name
    const nameKey = keys.find(k => /name|full_?name|lead_?name|customer_?name/i.test(k));
    if (nameKey) result.name = row[nameKey];

    // Find email
    const emailKey = keys.find(k => /email|mail|e-?mail/i.test(k));
    if (emailKey) result.email = row[emailKey];

    // Find phone
    const phoneKey = keys.find(k => /phone|mobile|contact|num|number|ph/i.test(k));
    if (phoneKey) result.mobile_without_country_code = row[phoneKey];

    // Find date
    const dateKey = keys.find(k => /date|time|created|created_?at/i.test(k));
    if (dateKey) result.created_at = row[dateKey];

    // Find company
    const companyKey = keys.find(k => /company|org|business|biz/i.test(k));
    if (companyKey) result.company = row[companyKey];

    // Find location fields
    const cityKey = keys.find(k => /city/i.test(k));
    if (cityKey) result.city = row[cityKey];
    
    const stateKey = keys.find(k => /state/i.test(k));
    if (stateKey) result.state = row[stateKey];
    
    const countryKey = keys.find(k => /country/i.test(k));
    if (countryKey) result.country = row[countryKey];

    // Find status
    const statusKey = keys.find(k => /status|stage/i.test(k));
    if (statusKey) {
      const statusVal = String(row[statusKey]).toUpperCase();
      if (statusVal.includes('GOOD') || statusVal.includes('FOLLOW')) result.crm_status = 'GOOD_LEAD_FOLLOW_UP';
      else if (statusVal.includes('CONNECT') || statusVal.includes('NOT')) result.crm_status = 'DID_NOT_CONNECT';
      else if (statusVal.includes('BAD') || statusVal.includes('JUNK')) result.crm_status = 'BAD_LEAD';
      else if (statusVal.includes('SALE') || statusVal.includes('DONE') || statusVal.includes('WON')) result.crm_status = 'SALE_DONE';
    }

    // Find source
    const sourceKey = keys.find(k => /source/i.test(k));
    if (sourceKey) {
      const sourceVal = String(row[sourceKey]).toLowerCase();
      if (sourceVal.includes('demand') || sourceVal.includes('lead')) result.data_source = 'leads_on_demand';
      else if (sourceVal.includes('meridian') || sourceVal.includes('tower')) result.data_source = 'meridian_tower';
      else if (sourceVal.includes('eden') || sourceVal.includes('park')) result.data_source = 'eden_park';
      else if (sourceVal.includes('varah') || sourceVal.includes('swamy')) result.data_source = 'varah_swamy';
      else if (sourceVal.includes('sarjapur') || sourceVal.includes('plot')) result.data_source = 'sarjapur_plots';
    }

    // Find note
    const noteKey = keys.find(k => /note|remark|comment/i.test(k));
    if (noteKey) result.crm_note = row[noteKey];

    // Find description
    const descKey = keys.find(k => /desc|description/i.test(k));
    if (descKey) result.description = row[descKey];

    // Find possession time
    const possKey = keys.find(k => /possession|time/i.test(k));
    if (possKey) result.possession_time = row[possKey];

    return result;
  });
}

const SYSTEM_INSTRUCTION = `
You are an expert CRM Data Integration Assistant. Your task is to analyze arbitrary JSON records parsed from a CSV file and map their fields into the following target CRM schema.

Target CRM Schema Fields:
- created_at: Lead creation date (must be convertable using new Date() in JavaScript)
- name: Lead name
- email: Primary email
- country_code: Country code if present (e.g. '+91')
- mobile_without_country_code: Mobile number (digits only, remove country code if present)
- company: Company name
- city: City
- state: State
- country: Country
- lead_owner: Lead owner
- crm_status: Lead status. MUST be exactly one of: ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"] or leave it blank.
- crm_note: General notes, remarks, follow-up comments, or additional metadata
- data_source: Data source. MUST be exactly one of: ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"] or leave it blank.
- possession_time: Property possession time
- description: Additional description

Mapping Rules:
1. Extract values carefully. If there are headers like "First Name" and "Last Name", combine them into "name".
2. If multiple email addresses exist, put the first email in the "email" field, and append the remaining ones into the "crm_note" field.
3. If multiple mobile numbers exist, put the first one in the "mobile_without_country_code" field, and append the remaining ones into the "crm_note".
4. If a field doesn't match any target field, put its value in "crm_note" or "description" to avoid data loss.
5. You MUST return a JSON array containing mapped objects. Each object should only contain fields from the CRM schema.
`;

const FEW_SHOT_EXAMPLES = `
Example input:
[
  {
    "date": "2026-05-13 14:20:48",
    "fullname": "John Doe",
    "email_addr": "john.doe@example.com, backup@example.com",
    "ph": "+91 9876543210",
    "biz_name": "GrowEasy",
    "location_city": "Mumbai",
    "loc_state": "Maharashtra",
    "loc_country": "India",
    "note": "Client is asking to reschedule demo",
    "source_val": "leads_on_demand",
    "status_val": "GOOD_LEAD_FOLLOW_UP"
  }
]

Example output:
[
  {
    "created_at": "2026-05-13 14:20:48",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "country_code": "+91",
    "mobile_without_country_code": "9876543210",
    "company": "GrowEasy",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "crm_status": "GOOD_LEAD_FOLLOW_UP",
    "crm_note": "Client is asking to reschedule demo | Extra Emails: backup@example.com",
    "data_source": "leads_on_demand"
  }
]
`;

export async function mapBatchWithGemini(rows: RawRow[]): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    return heuristicMapRows(rows);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash as specified in PRD
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const prompt = `
Please map the following records into the target CRM schema.
Here are some few-shot examples for reference:
${FEW_SHOT_EXAMPLES}

Input Records:
${JSON.stringify(rows, null, 2)}

Return the mapped output strictly as a JSON array of objects conforming to the CRM schema. Do not output any markdown formatting like \`\`\`json or explanations. Just return the raw JSON string.
`;

    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.response.text();
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed && typeof parsed === 'object') {
      // Sometimes LLMs return an object with a key like "records" or "data"
      const keys = Object.keys(parsed);
      for (const key of keys) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
      return [parsed];
    }
    throw new Error('Gemini output is not an array or object containing array');
  } catch (error: any) {
    console.error('[Gemini Service Error]', error);
    // If Gemini fails, fallback to heuristic mapper so user gets some results
    return heuristicMapRows(rows);
  }
}
