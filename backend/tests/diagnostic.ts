/**
 * Diagnostic: run the actual CSV through heuristic mapper and validation
 * to pinpoint where phone extraction breaks.
 */
import * as fs from 'fs';
import * as path from 'path';

// Minimal CSV parser
function parseCSV(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const values: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

import { heuristicMapRows } from '../src/services/geminiService';
import { sanitizeAndValidateRecord } from '../src/utils/validation';

const csvPath = path.join(__dirname, '../../sample_csvs/test_leads_messy.csv');
const rows = parseCSV(csvPath);

console.log('\n═══════════════════════════════════════════════════════');
console.log(' DIAGNOSTIC: test_leads_messy.csv');
console.log('═══════════════════════════════════════════════════════');
console.log('\n── RAW CSV HEADERS ──');
console.log(Object.keys(rows[0]).join(' | '));

console.log('\n── RAW ROW 0 (John Doe) ──');
console.log(JSON.stringify(rows[0], null, 2));

console.log('\n── HEURISTIC MAPPER OUTPUT ──');
const mapped = heuristicMapRows(rows);
mapped.forEach((m, i) => {
  const name = rows[i]['Full Name'] || `Row ${i+1}`;
  console.log(`\n[${i+1}] ${name}`);
  console.log(`  mobile_without_country_code: "${m.mobile_without_country_code ?? '(undefined)'}"`);
  console.log(`  email:   "${m.email ?? '(undefined)'}"`);
  console.log(`  city:    "${m.city ?? '(undefined)'}"`);
  console.log(`  state:   "${m.state ?? '(undefined)'}"`);
  console.log(`  crm_status: "${m.crm_status ?? '(undefined)'}"`);
});

console.log('\n── AFTER VALIDATION ──');
mapped.forEach((m, i) => {
  const name = rows[i]['Full Name'] || `Row ${i+1}`;
  const { record, skipped, reason } = sanitizeAndValidateRecord(m);
  console.log(`\n[${i+1}] ${name}: ${skipped ? '❌ SKIPPED — ' + reason : '✅ IMPORTED'}`);
  if (record) {
    console.log(`  mobile_without_country_code: "${record.mobile_without_country_code ?? ''}"`);
    console.log(`  email:   "${record.email ?? ''}"`);
    console.log(`  city:    "${record.city ?? ''}"`);
    console.log(`  crm_status: "${record.crm_status ?? ''}"`);
  }
});
