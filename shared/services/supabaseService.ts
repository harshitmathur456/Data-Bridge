import { createClient } from '@supabase/supabase-js';
import { CRMRecord, RawRow } from '../types';
import { SUPABASE_INSERT_CHUNK_SIZE } from '../constants';

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_ANON_KEY || '';
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
    }
    _client = createClient(url, key);
  }
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export interface SaveImportResult {
  sessionId: string | null;
  error?: string;
}

/**
 * Creates an import session and bulk-inserts all imported + skipped records.
 * Returns the session ID for reference.
 */
export async function saveImportToSupabase(params: {
  fileName: string;
  totalRows: number;
  imported: CRMRecord[];
  skipped: { row: RawRow; reason: string }[];
  aiEngine: string;
}): Promise<SaveImportResult> {
  const { fileName, totalRows, imported, skipped, aiEngine } = params;

  try {
    const supabase = getClient();

    // 1. Create the import session
    const { data: session, error: sessionError } = await supabase
      .from('import_sessions')
      .insert({
        file_name: fileName,
        total_rows: totalRows,
        total_imported: imported.length,
        total_skipped: skipped.length,
        ai_engine: aiEngine,
      } as any)
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('[Supabase] Failed to create session:', sessionError?.message);
      return { sessionId: null, error: sessionError?.message };
    }

    const sessionId = (session as { id: string }).id;

    // 2. Bulk insert CRM records (batch in chunks to stay under limits)
    if (imported.length > 0) {
      const crmRows = imported.map((rec) => ({ ...rec, session_id: sessionId }));
      for (let i = 0; i < crmRows.length; i += SUPABASE_INSERT_CHUNK_SIZE) {
        const chunk = crmRows.slice(i, i + SUPABASE_INSERT_CHUNK_SIZE);
        const { error: insertError } = await supabase.from('crm_records').insert(chunk as any);
        if (insertError) {
          console.error('[Supabase] CRM records insert error:', insertError.message);
        }
      }
    }

    // 3. Bulk insert skipped rows
    if (skipped.length > 0) {
      const skippedRows = skipped.map((s) => ({
        session_id: sessionId,
        raw_row: s.row,
        reason: s.reason,
      }));
      const { error: skipError } = await supabase.from('skipped_rows').insert(skippedRows as any);
      if (skipError) {
        console.error('[Supabase] Skipped rows insert error:', skipError.message);
      }
    }

    console.log(`[Supabase] Import session ${sessionId} saved — ${imported.length} imported, ${skipped.length} skipped`);
    return { sessionId };
  } catch (err: any) {
    console.error('[Supabase] Unexpected error:', err);
    return { sessionId: null, error: err.message || String(err) };
  }
}

export async function saveUserLogin(name: string, captchaInput: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('user_logins')
      .insert({
        name,
        captcha_input: captchaInput
      } as any);

    if (error) {
      console.error('[Supabase] Login save error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] Login unexpected error:', err);
    return { success: false, error: err.message || String(err) };
  }
}
