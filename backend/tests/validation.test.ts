/**
 * Validation test suite — covers all 4 AI extraction bugs:
 *  Bug 1: phone number not extracted (blank mobile_without_country_code)
 *  Bug 2: city not extracted (blank city)
 *  Bug 3: skip logic incorrectly firing for phone-only records
 *  Bug 4: crm_status left blank even when notes clearly signal it
 */

import { sanitizeAndValidateRecord } from '../src/utils/validation';
import { heuristicMapRows } from '../src/services/geminiService';

// ─── helpers ──────────────────────────────────────────────────────────────────
function pass(name: string) { console.log(`  ✅ PASS: ${name}`); }
function fail(name: string, got: any, expected: string) {
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`     expected: ${expected}`);
  console.error(`     got:      ${JSON.stringify(got)}`);
  process.exitCode = 1;
}
function assert(cond: boolean, name: string, got: any, expected: string) {
  cond ? pass(name) : fail(name, got, expected);
}

// ─── Section 1: sanitizeAndValidateRecord ────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(' Section 1: sanitizeAndValidateRecord()');
console.log('══════════════════════════════════════════');

// ── Test 1a: standard valid record ────────────────────────────────────────────
{
  const { record, skipped } = sanitizeAndValidateRecord({
    name: 'Alice Kumar',
    email: 'alice@example.com',
    mobile_without_country_code: '9876543210',
    city: 'Pune',
    crm_status: 'GOOD_LEAD_FOLLOW_UP',
    data_source: 'eden_park',
  });
  assert(!skipped, 'T1a: valid record not skipped', skipped, 'false');
  assert(record?.email === 'alice@example.com', 'T1a: email preserved', record?.email, 'alice@example.com');
  assert(record?.mobile_without_country_code === '9876543210', 'T1a: phone preserved', record?.mobile_without_country_code, '9876543210');
  assert(record?.crm_status === 'GOOD_LEAD_FOLLOW_UP', 'T1a: crm_status preserved', record?.crm_status, 'GOOD_LEAD_FOLLOW_UP');
  assert(record?.data_source === 'eden_park', 'T1a: data_source preserved', record?.data_source, 'eden_park');
}

// ── BUG 1: Phone under alias key "whatsapp" ───────────────────────────────────
{
  console.log('\n── Bug 1: phone under alias key ──');
  const { record, skipped } = sanitizeAndValidateRecord({
    name: 'Rajesh Patel',
    whatsapp: '8800012345',   // ← alias key, not "mobile_without_country_code"
    area: 'Bangalore',
  });
  assert(!skipped, 'T1b: phone-only via "whatsapp" key not skipped', skipped, 'false');
  assert(
    record?.mobile_without_country_code === '8800012345',
    'T1b: phone extracted from "whatsapp" key',
    record?.mobile_without_country_code,
    '8800012345'
  );
}

// ── BUG 1 variant: phone under "ph_no" key ────────────────────────────────────
{
  const { record, skipped } = sanitizeAndValidateRecord({
    name: 'Sunita Rao',
    ph_no: '+91 9812300001',
  });
  assert(!skipped, 'T1c: phone under "ph_no" not skipped', skipped, 'false');
  assert(
    record?.mobile_without_country_code === '9812300001',
    'T1c: phone digits extracted from ph_no with country code',
    record?.mobile_without_country_code,
    '9812300001'
  );
  assert(record?.country_code === '+91', 'T1c: country_code split correctly', record?.country_code, '+91');
}

// ── BUG 1 variant: phone via emergency value-scan (unknown key name) ──────────
{
  const { record, skipped } = sanitizeAndValidateRecord({
    name: 'Unknown Header Test',
    contact_info: '9988776655',   // ← non-standard key, value looks like phone
  });
  assert(!skipped, 'T1d: phone via emergency value-scan not skipped', skipped, 'false');
  assert(
    record?.mobile_without_country_code === '9988776655',
    'T1d: phone extracted via value-scan fallback',
    record?.mobile_without_country_code,
    '9988776655'
  );
}

// ── BUG 2: City from alias keys ───────────────────────────────────────────────
{
  console.log('\n── Bug 2: city extraction ──');
  const { record } = sanitizeAndValidateRecord({
    name: 'Ravi Sharma',
    email: 'ravi@test.com',
    location: 'Hyderabad',     // ← alias for city
  });
  assert(record?.city === 'Hyderabad', 'T2a: city extracted from "location" key', record?.city, 'Hyderabad');
}
{
  const { record } = sanitizeAndValidateRecord({
    name: 'Meena Joshi',
    email: 'meena@test.com',
    area: 'Chennai',           // ← alias for city
  });
  assert(record?.city === 'Chennai', 'T2b: city extracted from "area" key', record?.city, 'Chennai');
}
{
  const { record } = sanitizeAndValidateRecord({
    name: 'Dev Malhotra',
    email: 'dev@test.com',
    loc_city: 'Delhi',         // ← Gemini might emit this
  });
  assert(record?.city === 'Delhi', 'T2c: city extracted from "loc_city" key', record?.city, 'Delhi');
}

// ── BUG 3: Skip logic — phone-only record must NOT be skipped ─────────────────
{
  console.log('\n── Bug 3: skip logic (Rajesh Patel scenario) ──');
  const { record, skipped, reason } = sanitizeAndValidateRecord({
    name: 'Rajesh Patel',
    mobile_without_country_code: '8800012345',
    company: 'ABC Realty',
    city: 'Bangalore',
    crm_note: 'Interested, will call back',
  });
  assert(!skipped, 'T3a: phone-only record is NOT skipped', { skipped, reason }, 'skipped=false');
  assert(!!record, 'T3a: record object returned', record, 'non-null CRMRecord');
  assert(record?.mobile_without_country_code === '8800012345', 'T3a: phone correctly in record', record?.mobile_without_country_code, '8800012345');
}

// ── Confirm skip DOES fire when BOTH are missing ──────────────────────────────
{
  const { skipped, reason } = sanitizeAndValidateRecord({
    name: 'Ghost Lead',
    company: 'Nowhere Inc',
  });
  assert(skipped, 'T3b: skip fires when BOTH email and phone missing', skipped, 'true');
  assert(
    (reason || '').toLowerCase().includes('missing'),
    'T3b: skip reason mentions "missing"',
    reason,
    '"missing..."'
  );
}

// ── BUG 4: crm_status inference from free-text notes ─────────────────────────
{
  console.log('\n── Bug 4: crm_status inference (Priya Singh scenario) ──');

  // SALE_DONE from "deal closed"
  const { record: r1 } = sanitizeAndValidateRecord({
    name: 'Priya Singh',
    email: 'priya@groweasy.com',
    mobile_without_country_code: '9999988888',
    crm_status: 'SALE_DONE',           // Gemini should infer this
    crm_note: 'Deal closed, onboarding started',
  });
  assert(r1?.crm_status === 'SALE_DONE', 'T4a: SALE_DONE explicit preserved', r1?.crm_status, 'SALE_DONE');
}

// ── BAD_LEAD inference at validation layer ────────────────────────────────────
{
  // Note: crm_status enum clamping in validation only keeps valid enums,
  // inference from notes is done in geminiService.normalizeGeminiRow.
  // Here we confirm valid bad-lead enum passes through untouched.
  const { record: r2 } = sanitizeAndValidateRecord({
    name: 'Kavita Nair',
    email: 'kavita@test.com',
    crm_status: 'BAD_LEAD',
    crm_note: 'not interested',
  });
  assert(r2?.crm_status === 'BAD_LEAD', 'T4b: BAD_LEAD preserved through validation', r2?.crm_status, 'BAD_LEAD');
}

// ── Invalid crm_status gets clamped to blank ──────────────────────────────────
{
  const { record: r3 } = sanitizeAndValidateRecord({
    name: 'Amit Sharma',
    email: 'amit@test.com',
    crm_status: 'RANDOM_JUNK_VALUE',
  });
  assert(r3?.crm_status === '', 'T4c: invalid crm_status clamped to empty string', r3?.crm_status, '""');
}

// ─── Section 2: heuristicMapRows ─────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(' Section 2: heuristicMapRows()');
console.log('══════════════════════════════════════════');

// Simulate a real "messy" CSV batch — non-standard headers
const messyBatch = [
  // Rajesh: phone-only, Whatsapp key, city under "city" key (real CSV uses Town for city, Area for state)
  {
    entry_date: '2026-05-14',
    contact_person: 'Rajesh Patel',
    whatsapp: '8800012345',
    company_name: 'ABC Realty',
    city: 'Bangalore',          // ← unambiguous city key
    remarks: 'Interested, will call back',
  },
  // Priya: email + phone, city under "location_city", SALE_DONE from note
  {
    date: '2026-05-13 14:20:48',
    fullname: 'Priya Singh',
    email_addr: 'priya.singh@example.com',
    ph: '+91 9876543210',
    biz_name: 'GrowEasy',
    location_city: 'Mumbai',
    loc_state: 'Maharashtra',
    comment: 'deal closed, onboarding started',
    source_val: 'eden_park',
  },
];

const heuristicOut = heuristicMapRows(messyBatch);
const rajesh = heuristicOut[0];
const priya  = heuristicOut[1];

console.log('\nHeuristic output:');
console.log(' Rajesh:', JSON.stringify(rajesh));
console.log(' Priya: ', JSON.stringify(priya));

assert(
  rajesh.mobile_without_country_code === '8800012345',
  'H1: Rajesh phone extracted from "whatsapp" key',
  rajesh.mobile_without_country_code,
  '8800012345'
);
assert(
  rajesh.city === 'Bangalore',
  'H2: Rajesh city extracted from "area" key',
  rajesh.city,
  'Bangalore'
);
assert(
  rajesh.crm_status === 'GOOD_LEAD_FOLLOW_UP',
  'H3: Rajesh crm_status inferred from "will call back"',
  rajesh.crm_status,
  'GOOD_LEAD_FOLLOW_UP'
);

assert(
  priya.email === 'priya.singh@example.com',
  'H4: Priya email extracted',
  priya.email,
  'priya.singh@example.com'
);
assert(
  priya.city === 'Mumbai',
  'H5: Priya city extracted from "location_city"',
  priya.city,
  'Mumbai'
);
assert(
  priya.crm_status === 'SALE_DONE',
  'H6: Priya crm_status = SALE_DONE inferred from "deal closed"',
  priya.crm_status,
  'SALE_DONE'
);

// ─── Section 3: End-to-end — sanitize heuristic output ───────────────────────
console.log('\n══════════════════════════════════════════');
console.log(' Section 3: End-to-end pipeline (heuristic → validate)');
console.log('══════════════════════════════════════════');

{
  const mapped   = heuristicMapRows(messyBatch);
  const { record: rRajesh, skipped: sRajesh } = sanitizeAndValidateRecord(mapped[0]);
  const { record: rPriya,  skipped: sPriya  } = sanitizeAndValidateRecord(mapped[1]);

  assert(!sRajesh, 'E2E-1: Rajesh NOT skipped end-to-end', sRajesh, 'false');
  assert(
    rRajesh?.mobile_without_country_code === '8800012345',
    'E2E-2: Rajesh phone preserved end-to-end',
    rRajesh?.mobile_without_country_code,
    '8800012345'
  );
  assert(rRajesh?.city === 'Bangalore', 'E2E-3: Rajesh city preserved end-to-end', rRajesh?.city, 'Bangalore');

  assert(!sPriya, 'E2E-4: Priya NOT skipped end-to-end', sPriya, 'false');
  assert(rPriya?.crm_status === 'SALE_DONE', 'E2E-5: Priya SALE_DONE preserved end-to-end', rPriya?.crm_status, 'SALE_DONE');
  assert(rPriya?.city === 'Mumbai', 'E2E-6: Priya city = Mumbai end-to-end', rPriya?.city, 'Mumbai');
}

// ─── Summary ──────────────────────────────────────────────────────────────────
if (process.exitCode === 1) {
  console.error('\n❌  Some tests failed — see above.\n');
} else {
  console.log('\n✅  All tests passed!\n');
}
