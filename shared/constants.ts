export const IMPORT_BATCH_SIZE = 20;

export const TABLE_PAGE_SIZE = 10;

export const GEMINI_MAX_RETRIES = 2;

export const RETRY_BASE_DELAY_MS = 1000;

export const SUPABASE_INSERT_CHUNK_SIZE = 100;

export const ALLOWED_CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE'
] as const;

export const ALLOWED_DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots'
] as const;
