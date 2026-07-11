import React from 'react';
import { Sparkles } from 'lucide-react';
import { RawRow } from '@shared/types';

interface BatchProgressItem {
  n: number;
  status: 'idle' | 'running' | 'done' | 'error';
  errorMsg?: string;
}

interface ImportingStepProps {
  failedChunks: { chunk: RawRow[]; originalIndex: number }[];
  importingState: { total: number; current: number; status: 'idle' | 'running' | 'done' };
  batchProgress: BatchProgressItem[];
  progressPct: number;
  dark?: boolean;
}

export default function ImportingStep({
  failedChunks,
  importingState,
  batchProgress,
  progressPct,
  dark
}: ImportingStepProps) {
  const cardCls = `card border rounded-2xl`;

  return (
    <div className="flex items-center justify-center min-h-full p-10">
      <div className="w-full max-w-lg flex flex-col gap-5">
        <div className={`${cardCls} shadow-sm p-7 text-center flex flex-col items-center`}>
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 animate-bounce ${dark ? "bg-purple-900/30" : "bg-purple-50"}`}>
            <Sparkles className="h-7 w-7 text-purple-500 fill-current" />
          </div>
          <h2 className="text-2xl font-bold font-display text-base-color mb-1">
            {failedChunks.length > 0 && importingState.status === "running" ? "Retrying Failed Batches" : "AI Mapping in Progress"}
          </h2>
          <p className="text-sm text-muted-color mb-6">
            {importingState.status === "running"
              ? `Processing batch ${importingState.current} of ${importingState.total}…`
              : "Gemini is intelligently mapping your CSV. Please wait…"}
          </p>

          <div className={`w-full h-3 rounded-full overflow-hidden mb-3 ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
            <div 
              className="h-full progress-bar-animated rounded-full transition-all duration-500"
              style={{ width: `${Math.max(3, progressPct)}%` }} 
            />
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center mb-3">
            {batchProgress.map(b => (
              <div 
                key={b.n} 
                title={b.status === "error" ? `Batch ${b.n} Failed: ${b.errorMsg || ""}` : `Batch ${b.n}`}
                className={`h-2 w-6 rounded-full transition-all ${
                  b.status === "done" ? "bg-emerald-500"
                  : b.status === "running" ? "progress-bar-animated"
                  : b.status === "error" ? "bg-red-500 shadow-sm shadow-red-500/50"
                  : dark ? "bg-slate-700" : "bg-gray-200"
                }`} 
              />
            ))}
          </div>

          <div className="flex justify-between w-full text-xs text-muted-color font-medium">
            <span>
              {importingState.status === "running" 
                ? `Batch ${importingState.current} of ${importingState.total}`
                : `Batch ${batchProgress.filter(p => p.status !== "idle").length} of ${batchProgress.length}`}
            </span>
            <span className="font-bold text-brand">{Math.round(progressPct)}% Complete</span>
          </div>
        </div>
      </div>
    </div>
  );
}
