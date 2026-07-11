import { Router, Request, Response } from 'express';
import { mapBatchWithGemini } from '@shared/services/geminiService';
import { sanitizeAndValidateRecord } from '@shared/utils/validation';
import { saveImportToSupabase, isSupabaseConfigured } from '@shared/services/supabaseService';
import { RawRow, CRMRecord, ImportRequest } from '@shared/types';

const router = Router();

// POST /api/import — maps a single batch of rows
router.post('/', async (req: Request<{}, {}, ImportRequest>, res: Response) => {
  try {
    const { rows, fileName, isFinalBatch, allImported, allSkipped, totalRows, aiEngine } = req.body;

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Invalid request: "rows" must be an array.' });
    }

    const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = keysStr
      .split(',')
      .map(k => k.trim())
      .filter(k => k && k !== 'YOUR_GEMINI_API_KEY');
    const isMock = apiKeys.length === 0;
    res.setHeader('X-Mock-AI', isMock ? 'true' : 'false');

    if (rows.length === 0 && !isFinalBatch) {
      return res.status(200).json({ imported: [], skipped: [], total_imported: 0, total_skipped: 0 });
    }

    // Map this batch via Gemini (or heuristic fallback) with up to 2 retries (3 attempts total)
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
            const delay = Math.pow(2, attempts) * 1000; // 2s, 4s delay
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            failed = true;
          }
        }
      }
    }

    if (failed) {
      return res.status(200).json({
        failed: true,
        error: `Batch failed after 2 retries. Error: ${errorMessage}`,
        failedRows: rows
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

    // If this is the final batch, save the full import to Supabase
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
        aiEngine: aiEngine || (isMock ? 'Local Mock Mapper' : 'Gemini 1.5 Flash'),
      });
      sessionId = result.sessionId;
      supabaseError = result.error;
    }

    return res.status(200).json({
      imported,
      skipped,
      total_imported: imported.length,
      total_skipped: skipped.length,
      session_id: sessionId,
      supabase_saved: isFinalBatch && isSupabaseConfigured() && !supabaseError,
      supabase_error: supabaseError,
    });
  } catch (error: any) {
    console.error('[Import API Error]', error);
    return res.status(500).json({ error: 'Internal server error during import.' });
  }
});

export default router;
