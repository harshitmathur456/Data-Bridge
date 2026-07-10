import { NextResponse } from 'next/server';
import { mapBatchWithGemini, RawRow } from '../../../services/geminiService';
import { sanitizeAndValidateRecord, CRMRecord } from '../../../utils/validation';
import { saveImportToSupabase, isSupabaseConfigured } from '../../../services/supabaseService';

interface ImportRequest {
  rows: RawRow[];
  fileName?: string;
  isFinalBatch?: boolean;
  allImported?: CRMRecord[];
  allSkipped?: { row: RawRow; reason: string }[];
  totalRows?: number;
  aiEngine?: string;
}

export async function POST(request: Request) {
  try {
    const body: ImportRequest = await request.json();
    const { rows, fileName, isFinalBatch, allImported, allSkipped, totalRows, aiEngine } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid request: "rows" must be an array.' }, { status: 400 });
    }

    const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = keysStr
      .split(',')
      .map(k => k.trim())
      .filter(k => k && k !== 'YOUR_GEMINI_API_KEY');
    const isMock = apiKeys.length === 0;

    const responseHeaders = new Headers();
    responseHeaders.set('X-Mock-AI', isMock ? 'true' : 'false');
    // Ensure exposed headers include X-Mock-AI so browser can read it
    responseHeaders.set('Access-Control-Expose-Headers', 'X-Mock-AI');

    if (rows.length === 0 && !isFinalBatch) {
      return NextResponse.json({ imported: [], skipped: [], total_imported: 0, total_skipped: 0 }, {
        status: 200,
        headers: responseHeaders
      });
    }

    let mappedRows: any[] = [];
    let failed = false;
    let errorMessage = '';

    if (rows.length > 0) {
      let attempts = 0;
      const maxRetries = 2;
      while (attempts <= maxRetries) {
        try {
          mappedRows = await mapBatchWithGemini(rows);
          failed = false;
          break;
        } catch (err: any) {
          attempts++;
          errorMessage = err?.message || String(err);
          console.warn(`[Gemini Ingestion Attempt ${attempts} Failed]: ${errorMessage}`);
          if (attempts <= maxRetries) {
            const delay = Math.pow(2, attempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            failed = true;
          }
        }
      }
    }

    if (failed) {
      return NextResponse.json({
        failed: true,
        error: `Batch failed after 2 retries. Error: ${errorMessage}`,
        failedRows: rows
      }, {
        status: 200,
        headers: responseHeaders
      });
    }

    const imported: CRMRecord[] = [];
    const skipped: { row: RawRow; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const originalRow = rows[i];
      const mappedRow = mappedRows[i] || {};
      const { record, skipped: isSkipped, reason } = sanitizeAndValidateRecord(mappedRow);

      if (isSkipped || !record) {
        skipped.push({ row: originalRow, reason: reason || 'AI failed to extract required fields' });
      } else {
        imported.push(record);
      }
    }

    let sessionId: string | null = null;
    let supabaseError: string | undefined;

    if (isFinalBatch && isSupabaseConfigured() && allImported && allSkipped) {
      const combinedImported = [...(allImported || []), ...imported];
      const combinedSkipped = [...(allSkipped || []), ...skipped];
      const result = await saveImportToSupabase({
        fileName: fileName || 'unknown.csv',
        totalRows: totalRows || rows.length,
        imported: combinedImported,
        skipped: combinedSkipped,
        aiEngine: aiEngine || (isMock ? 'Local Mock Mapper' : 'Gemini 2.0 Flash'),
      });
      sessionId = result.sessionId;
      supabaseError = result.error;
    }

    return NextResponse.json({
      imported,
      skipped,
      total_imported: imported.length,
      total_skipped: skipped.length,
      session_id: sessionId,
      supabase_saved: isFinalBatch && isSupabaseConfigured() && !supabaseError,
      supabase_error: supabaseError,
    }, {
      status: 200,
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error('[Import API Error]', error);
    return NextResponse.json({ error: 'Internal server error during import.' }, { status: 500 });
  }
}
