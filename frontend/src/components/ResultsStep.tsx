import React, { useState, useMemo } from 'react';
import { Plus, Check, Sparkles, AlertTriangle, AlertCircle, Filter } from 'lucide-react';
import { CRMRecord, SkippedRecord, RawRow } from '@shared/types';
import Pagination from './ui/Pagination';
import { TABLE_PAGE_SIZE } from '@shared/constants';

const CRM_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All', color: '' },
  { value: 'GOOD_LEAD_FOLLOW_UP', label: 'Good Lead Follow Up', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' },
  { value: 'DID_NOT_CONNECT',     label: 'Did Not Connect',     color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
  { value: 'BAD_LEAD',            label: 'Bad Lead',            color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
  { value: 'SALE_DONE',           label: 'Sale Done',           color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
] as const;

type CRMStatusFilter = (typeof CRM_STATUS_OPTIONS)[number]['value'];

interface ResultsStepProps {
  importedRecords: CRMRecord[];
  skippedRecords: SkippedRecord[];
  failedChunks: { chunk: RawRow[]; originalIndex: number }[];
  supabaseSaved: boolean;
  aiEngine: string;
  headers: string[];
  reset: () => void;
  retryFailedBatches: () => void;
  dark?: boolean;
}

const getCountryCode = (cc: string) => {
  if (cc === "+91") return "in";
  if (cc === "+1") return "us";
  if (cc === "+44") return "gb";
  if (cc === "+61") return "au";
  if (cc === "+86") return "cn";
  if (cc === "+65") return "sg";
  return null;
};

const crmBadge = (s?: string, dark?: boolean) => {
  if (s === "GOOD_LEAD_FOLLOW_UP") return "bg-emerald-100 text-emerald-700";
  if (s === "SALE_DONE") return "bg-blue-100 text-blue-700";
  if (s === "DID_NOT_CONNECT") return "bg-amber-100 text-amber-700";
  if (s === "BAD_LEAD") return "bg-red-100 text-red-700";
  return dark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500";
};

// Memoized Imported Row Component
const ImportedRow = React.memo(function ImportedRow({
  record,
  index,
  dark
}: {
  record: CRMRecord;
  index: number;
  dark?: boolean;
}) {
  return (
    <tr className="hover-bg transition-colors">
      <td className="px-5 py-3.5 text-brand font-mono text-xs font-semibold">CRM-{String(index + 1).padStart(4, "0")}</td>
      <td className="px-5 py-3.5 font-semibold text-base-color">{record.name || "—"}</td>
      <td className="px-5 py-3.5 text-brand">{record.email || "—"}</td>
      <td className="px-5 py-3.5 text-brand font-mono text-xs">
        {record.country_code ? (
          <span className="inline-flex items-center gap-1.5">
            {getCountryCode(record.country_code) ? (
              <img 
                src={`https://flagcdn.com/w20/${getCountryCode(record.country_code)}.png`} 
                alt="" 
                className="w-4 h-[11px] object-cover rounded-[1px] shadow-sm" 
              />
            ) : (
              <span className="text-sm">🌐</span>
            )}
            {record.country_code}
          </span>
        ) : "—"}
      </td>
      <td className="px-5 py-3.5 text-muted-color font-mono text-xs">{record.mobile_without_country_code || "—"}</td>
      <td className="px-5 py-3.5 text-base-color">{record.company || "—"}</td>
      <td className="px-5 py-3.5 text-base-color">{record.city || "—"}</td>
      <td className="px-5 py-3.5">
        {record.crm_status ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${crmBadge(record.crm_status, dark)}`}>
            {record.crm_status.replace(/_/g, " ")}
          </span>
        ) : (
          <span className="text-muted-color opacity-40">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
          <Check className="h-3 w-3 stroke-[2.5]" /> Synced
        </span>
      </td>
    </tr>
  );
});

// Memoized Skipped Row Component
const SkippedRow = React.memo(function SkippedRow({
  skipped,
  headers
}: {
  skipped: SkippedRecord;
  headers: string[];
}) {
  return (
    <tr className="transition-colors hover:bg-red-50/30 dark:hover:bg-red-900/10">
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
          <AlertCircle className="h-3 w-3" /> {skipped.reason}
        </span>
      </td>
      {headers.map(h => (
        <td key={h} className="px-5 py-3.5 text-base-color max-w-[160px] truncate">
          {skipped.row[h] || <span className="text-muted-color opacity-40">—</span>}
        </td>
      ))}
    </tr>
  );
});

export default function ResultsStep({
  importedRecords,
  skippedRecords,
  failedChunks,
  supabaseSaved,
  aiEngine,
  headers,
  reset,
  retryFailedBatches,
  dark
}: ResultsStepProps) {
  const [resultTab, setResultTab] = useState<'imported' | 'skipped'>('imported');
  const [resultPage, setResultPage] = useState(1);
  const [crmFilter, setCrmFilter] = useState<CRMStatusFilter>('ALL');

  const filteredImported = useMemo(() => {
    if (crmFilter === 'ALL') return importedRecords;
    return importedRecords.filter(r => r.crm_status === crmFilter);
  }, [importedRecords, crmFilter]);

  const paginatedImported = useMemo(() => {
    return filteredImported.slice((resultPage - 1) * TABLE_PAGE_SIZE, resultPage * TABLE_PAGE_SIZE);
  }, [filteredImported, resultPage]);

  const paginatedSkipped = useMemo(() => {
    return skippedRecords.slice((resultPage - 1) * TABLE_PAGE_SIZE, resultPage * TABLE_PAGE_SIZE);
  }, [skippedRecords, resultPage]);

  const totalResultPages = Math.ceil(
    (resultTab === 'imported' ? filteredImported.length : skippedRecords.length) / TABLE_PAGE_SIZE
  );

  const handleCrmFilter = (val: CRMStatusFilter) => {
    setCrmFilter(val);
    setResultPage(1);
  };

  const cardCls = `card border rounded-2xl`;

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-base-color">Import Complete</h1>
          <p className="text-sm text-muted-color mt-0.5">Your data has been processed and synced to the CRM.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {supabaseSaved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                <Check className="h-3.5 w-3.5" /> Saved to Supabase
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${dark ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700"}`}>
              <Sparkles className="h-3.5 w-3.5 fill-current" /> {aiEngine}
            </span>
          </div>
        </div>
        <button 
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00463f] text-white text-sm font-semibold hover:bg-[#225e56] transition-all shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Start New Import
        </button>
      </div>

      {failedChunks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200 text-base">Some batches failed processing</h3>
              <p className="text-sm text-red-700 dark:text-red-300/80 mt-0.5">
                {failedChunks.length} batch(es) ({failedChunks.reduce((acc, curr) => acc + curr.chunk.length, 0)} rows) failed to process with AI after 2 retries. You can retry importing these.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {failedChunks.map(f => (
                  <span key={f.originalIndex} className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                    Batch {f.originalIndex + 1} ({f.chunk.length} rows)
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button 
            onClick={retryFailedBatches} 
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-sm shrink-0 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Retry Failed Batches
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <div className={`${cardCls} shadow-sm p-6 relative overflow-hidden`}>
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-100 translate-x-10 -translate-y-10 opacity-50" />
          <div className="flex items-start gap-4 relative">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${dark ? "bg-emerald-900/40" : "bg-emerald-100"}`}>
              <Check className="h-5 w-5 text-emerald-600 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-sm text-muted-color font-medium mb-0.5">Total Imported</p>
              <p className="text-5xl font-bold font-display text-base-color">{importedRecords.length.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1"><span>↗</span> Successfully mapped</p>
            </div>
          </div>
        </div>
        <div className={`${cardCls} shadow-sm p-6 relative overflow-hidden`}>
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-orange-100 translate-x-10 -translate-y-10 opacity-50" />
          <div className="flex items-start gap-4 relative">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${dark ? "bg-orange-900/40" : "bg-orange-100"}`}>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-color font-medium mb-0.5">Total Skipped</p>
              <p className="text-5xl font-bold font-display text-base-color">{skippedRecords.length.toLocaleString()}</p>
              <p className="text-xs text-orange-600 font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Failed validation</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-color">
        {(['imported', 'skipped'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => { setResultTab(tab); setResultPage(1); }}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              resultTab === tab 
                ? "border-brand text-brand" 
                : `border-transparent ${dark ? "text-slate-500" : "text-gray-400"} hover:text-gray-600`
            }`}
          >
            {tab === "imported" ? `Imported Records (${importedRecords.length})` : `Skipped Rows (${skippedRecords.length})`}
          </button>
        ))}
      </div>

      <div className={`${cardCls} shadow-sm overflow-hidden flex flex-col`}>
        {/* CRM Status Filter — only shown on imported tab */}
        {resultTab === "imported" && (
          <div className={`flex flex-wrap items-center gap-2 px-5 py-3 border-b border-color ${dark ? "bg-slate-800/60" : "bg-gray-50/80"}`}>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? "text-slate-400" : "text-gray-500"}`}>
              <Filter className="h-3.5 w-3.5" /> CRM Status
            </span>
            {CRM_STATUS_OPTIONS.map(opt => {
              const isActive = crmFilter === opt.value;
              const allStyle = isActive
                ? `bg-[#00463f] text-white border-[#00463f]`
                : `${dark ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleCrmFilter(opt.value)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${
                    opt.value === 'ALL'
                      ? allStyle
                      : isActive
                        ? `${opt.color.split(' ')[0].replace('bg-', 'bg-').replace('100', '600')} text-white border-transparent`
                        : `${opt.color} border`
                  }`}
                >
                  {opt.value === 'ALL'
                    ? `All (${importedRecords.length})`
                    : `${opt.label} (${importedRecords.filter(r => r.crm_status === opt.value).length})`
                  }
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-auto custom-scrollbar">
          {resultTab === "imported" ? (
            <table className="w-full min-w-max text-sm">
              <thead className={`border-b border-color ${dark ? "bg-slate-800" : "bg-gray-50"}`}>
                <tr>
                  {["CRM ID", "Name", "Email", "Country Code", "Phone", "Company", "City", "CRM Status", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-color">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? "divide-slate-700/50" : "divide-gray-50"}`}>
                {paginatedImported.map((record, i) => {
                  const globalIndex = (resultPage - 1) * TABLE_PAGE_SIZE + i;
                  return (
                    <ImportedRow 
                      key={globalIndex} 
                      record={record} 
                      index={globalIndex} 
                      dark={dark} 
                    />
                  );
                })}
                {filteredImported.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-muted-color">
                      {crmFilter === 'ALL' ? 'No records were imported.' : `No records with status "${CRM_STATUS_OPTIONS.find(o => o.value === crmFilter)?.label}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-max text-sm">
              <thead className={`border-b border-color ${dark ? "bg-slate-800" : "bg-gray-50"}`}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color">Skip Reason</th>
                  {headers.map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-color">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? "divide-slate-700/50" : "divide-gray-50"}`}>
                {paginatedSkipped.map((skipped, i) => {
                  const globalIndex = (resultPage - 1) * TABLE_PAGE_SIZE + i;
                  return (
                    <SkippedRow 
                      key={globalIndex} 
                      skipped={skipped} 
                      headers={headers} 
                    />
                  );
                })}
                {skippedRecords.length === 0 && (
                  <tr>
                    <td colSpan={headers.length + 1} className="px-5 py-10 text-center text-muted-color">
                      No skipped records. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination 
          currentPage={resultPage}
          totalPages={totalResultPages}
          totalItems={resultTab === "imported" ? filteredImported.length : skippedRecords.length}
          pageSize={TABLE_PAGE_SIZE}
          onPageChange={setResultPage}
          dark={dark}
        />
      </div>
    </div>
  );
}

// Re-export RefreshCw icon since it's referenced in retry banner
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
