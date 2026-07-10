import { sanitizeAndValidateRecord } from '../src/utils/validation';

const cases = [
  { label: 'Neha — heuristic raw (+91 with space)',  mobile_without_country_code: '+91 9988776655',  email: 'neha.g@test.co' },
  { label: 'Concat no space (+919988776655)',         mobile_without_country_code: '+919988776655',   email: 'test@x.com' },
  { label: 'Already split — Gemini ideal output',    mobile_without_country_code: '9988776655', country_code: '+91', email: 'test@x.com' },
  { label: 'Malformed 98765XXXXX',                   mobile_without_country_code: '98765XXXXX',  email: 'anjali@x.com', crm_note: 'intentionally bad' },
  { label: 'Clean 10-digit — no prefix',             mobile_without_country_code: '9876543210',  email: 'clean@x.com' },
  { label: 'Gemini puts CC in mobile field raw',     mobile_without_country_code: '+91-9812300001', email: 'dash@x.com' },
];

console.log('\n═══ LIVE PHONE SPLIT VERIFICATION ═══\n');

let allOk = true;
for (const c of cases) {
  const { record, skipped, reason } = sanitizeAndValidateRecord(c as any);
  console.log(`[${c.label}]`);
  if (skipped) { console.log(`  ❌ SKIPPED: ${reason}\n`); allOk = false; continue; }
  const cc  = record?.country_code ?? '(none)';
  const mob = record?.mobile_without_country_code ?? '(none)';
  const note = record?.crm_note ?? '(none)';
  console.log(`  country_code:                ${JSON.stringify(cc)}`);
  console.log(`  mobile_without_country_code: ${JSON.stringify(mob)}`);
  console.log(`  crm_note:                    ${JSON.stringify(note)}`);

  // Check: mobile must be pure digits (7-15), no plus or country code prefix
  const mobileStr = mob === '(none)' ? '' : mob;
  const hasCCLeak = mobileStr.startsWith('+') || /^91\d{10}$/.test(mobileStr) || /^44\d{10}$/.test(mobileStr);
  const isValidDigits = /^\d{7,15}$/.test(mobileStr);

  if (mobileStr && hasCCLeak) {
    console.log('  ⚠️  BUG: country code leaked into mobile field!');
    allOk = false;
  } else if (mobileStr && !isValidDigits) {
    console.log('  ⚠️  BUG: mobile has non-digit chars (invalid not caught?)');
    allOk = false;
  } else if (!mobileStr && !note.includes('invalid phone') && c.mobile_without_country_code.replace(/\D/g,'').length >= 7) {
    console.log('  ⚠️  unexpected blank mobile');
    allOk = false;
  } else {
    console.log('  ✅ OK');
  }
  console.log();
}

if (allOk) {
  console.log('✅ All cases passed — CC split working correctly.\n');
} else {
  console.log('❌ Some cases failed.\n');
  process.exitCode = 1;
}
