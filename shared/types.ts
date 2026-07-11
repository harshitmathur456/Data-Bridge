export type Step = 'upload' | 'preview' | 'importing' | 'results';

export type CRMStatus = 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE' | '';

export type DataSource = 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | '';

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
  crm_status?: CRMStatus;
  crm_note?: string;
  data_source?: DataSource;
  possession_time?: string;
  description?: string;
}

export interface RawRow {
  [key: string]: string;
}

export interface SkippedRecord {
  row: RawRow;
  reason: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  rowsCount: number;
  headers: string[];
  rows: RawRow[];
}

export interface ImportRequest {
  rows: RawRow[];
  fileName?: string;
  isFinalBatch?: boolean;
  allImported?: CRMRecord[];
  allSkipped?: SkippedRecord[];
  totalRows?: number;
  aiEngine?: string;
}

export interface ImportResponse {
  imported: CRMRecord[];
  skipped: SkippedRecord[];
  total_imported: number;
  total_skipped: number;
  session_id: string | null;
  supabase_saved: boolean;
  supabase_error?: string;
  failed?: boolean;
  error?: string;
  failedRows?: RawRow[];
}
