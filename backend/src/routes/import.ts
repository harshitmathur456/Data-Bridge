import { Router, Request, Response } from 'express';
import { mapBatchWithGemini, RawRow } from '../services/geminiService';
import { sanitizeAndValidateRecord, CRMRecord } from '../utils/validation';
import { saveImportToSupabase, isSupabaseConfigured } from '../services/supabaseService';

const router = Router();

interface ImportRequest {
  rows: RawRow[];
  fileName?: string;
  isFinalBatch?: boolean;
  // For batch-level Supabase saving pass these from the frontend
  allImported?: CRMRecord[];
  allSkipped?: { row: RawRow; reason: string }[];
  totalRows?: number;
  aiEngine?: string;
}

// POST /api/import — maps a single batch of rows
router.post('/', async (req: Request<{}, {}, ImportRequest>, res: Response) => {
  try {
    const { rows, fileName, isFinalBatch, allImported, allSkipped, totalRows, aiEngine } = req.body;

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Invalid request: "rows" must be an array.' });
    }

    const isMock = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY';
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
