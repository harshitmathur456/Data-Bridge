import { sanitizeAndValidateRecord } from '../src/utils/validation';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- Running Validation Tests ---');

  // Test 1: Standard valid record mapping
  {
    const raw = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      mobile_without_country_code: '9876543210',
      crm_status: 'good_lead_follow_up',
      data_source: 'leads_on_demand'
    };
    const { record, skipped } = sanitizeAndValidateRecord(raw);
    assert(!skipped, 'Should not be skipped');
    assert(record?.name === 'John Doe', 'Name matches');
    assert(record?.email === 'john.doe@example.com', 'Email matches');
    assert(record?.mobile_without_country_code === '9876543210', 'Phone matches');
    assert(record?.crm_status === 'GOOD_LEAD_FOLLOW_UP', 'Status maps uppercase');
    assert(record?.data_source === 'leads_on_demand', 'Source maps exactly');
    console.log('✓ Test 1: Standard valid record passed.');
  }

  // Test 2: Multiple emails extraction
  {
    const raw = {
      name: 'Alice Smith',
      email: 'alice@example.com, secondary@example.com, tertiary@example.com',
      mobile_without_country_code: '9876543211',
      crm_note: 'Existing notes'
    };
    const { record, skipped } = sanitizeAndValidateRecord(raw);
    assert(!skipped, 'Should not be skipped');
    assert(record?.email === 'alice@example.com', 'First email maps to primary email');
    assert(
      record?.crm_note?.includes('Extra Emails: secondary@example.com, tertiary@example.com'),
      'Remaining emails appended to notes'
    );
    assert(record?.crm_note?.startsWith('Existing notes'), 'Keeps existing note content');
    console.log('✓ Test 2: Multiple emails handling passed.');
  }

  // Test 3: Multiple mobile numbers and country code extraction
  {
    const raw = {
      name: 'Bob Johnson',
      email: 'bob@example.com',
      mobile_without_country_code: '+919876543212, +919876543213',
      crm_note: ''
    };
    const { record, skipped } = sanitizeAndValidateRecord(raw);
    assert(!skipped, 'Should not be skipped');
    assert(record?.country_code === '+91', 'Country code extracted');
    assert(record?.mobile_without_country_code === '9876543212', 'First mobile maps to primary');
    assert(record?.crm_note?.includes('Extra Mobiles: +919876543213'), 'Extra mobile appended to notes');
    console.log('✓ Test 3: Multiple mobile numbers and country code passed.');
  }

  // Test 4: Skip validation (missing both contact details)
  {
    const raw = {
      name: 'Charlie Brown',
      company: 'ACME Corp',
      city: 'Delhi'
    };
    const { record, skipped, reason } = sanitizeAndValidateRecord(raw);
    assert(skipped, 'Should be skipped');
    assert(record === null, 'Record should be null');
    assert(reason === 'Missing email and mobile number', 'Correct skip reason');
    console.log('✓ Test 4: Skip invalid record passed.');
  }

  // Test 5: Enum validation fallback
  {
    const raw = {
      name: 'Dave Jones',
      email: 'dave@example.com',
      crm_status: 'INVALID_STATUS_VALUE',
      data_source: 'UNKNOWN_SOURCE'
    };
    const { record, skipped } = sanitizeAndValidateRecord(raw);
    assert(!skipped, 'Should not be skipped');
    assert(record?.crm_status === '', 'Invalid status clamped to empty string');
    assert(record?.data_source === '', 'Invalid source clamped to empty string');
    console.log('✓ Test 5: Enum clamping fallback passed.');
  }

  console.log('--- All Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
