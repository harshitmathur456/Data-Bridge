import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Search, Filter, Sparkles, AlertCircle, Check } from 'lucide-react';
import { UploadedFile, RawRow } from '@shared/types';
import Pagination from './ui/Pagination';
import { StepperBar } from './ui/StepperBar';
import { TABLE_PAGE_SIZE } from '@shared/constants';

interface PreviewStepProps {
  files: UploadedFile[];
  rawRows: RawRow[];
  headers: string[];
  onCancel: () => void;
  onConfirm: () => void;
  dark?: boolean;
}

const rowMissingContact = (row: RawRow) => {
  const keys = Object.keys(row);
  const ek = keys.find(k => /email|mail/i.test(k));
  const pk = keys.find(k => /phone|mobile|contact|ph/i.test(k));
  return !(ek && row[ek]?.trim()) && !(pk && row[pk]?.trim());
};

// Memoized single row component to prevent unnecessary re-renders of all rows
// when search term changes or pagination occurs.
const PreviewRow = React.memo(function PreviewRow({
  row,
  index,
  headers,
  dark
}: {
  row: RawRow;
  index: number;
  headers: string[];
  dark?: boolean;
}) {
  const isBad = rowMissingContact(row);
  return (
    <tr className={`transition-colors ${isBad ? (dark ? "bg-amber-900/10" : "bg-amber-50/40") : ""} hover-bg`}>
      <td className="px-5 py-3 text-xs text-muted-color">{index + 1}</td>
      <td className="px-5 py-3">
        {isBad ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            <AlertCircle className="h-3 w-3" /> Will Skip
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <Check className="h-3 w-3" /> OK
          </span>
        )}
      </td>
      {headers.map(h => (
        <td key={h} className="px-5 py-3 max-w-[180px] truncate whitespace-nowrap text-base-color">
          {row[h] ? (
            /email|mail/i.test(h) ? (
              <span className="text-brand">{row[h]}</span>
            ) : (
              row[h]
            )
          ) : (
            <span className="text-muted-color opacity-40">—</span>
          )}
        </td>
      ))}
    </tr>
  );
});

export default function PreviewStep({
  files,
  rawRows,
  headers,
  onCancel,
  onConfirm,
  dark
}: PreviewStepProps) {
  const [search, setSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return rawRows;
    const lowerSearch = search.toLowerCase();
    return rawRows.filter(r => 
      Object.values(r).some(v => v.toLowerCase().includes(lowerSearch))
    );
  }, [rawRows, search]);

  const previewRows = useMemo(() => {
    return filtered.slice((previewPage - 1) * TABLE_PAGE_SIZE, previewPage * TABLE_PAGE_SIZE);
  }, [filtered, previewPage]);

  const totalPreviewPages = Math.ceil(filtered.length / TABLE_PAGE_SIZE);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPreviewPage(1);
  };

  const cardCls = `card border rounded-2xl`;
  const inputCls = `w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-color input-bg focus:outline-none focus:ring-2 focus:ring-[#00463f]/30 transition-all text-base-color`;

  return (
    <div className="flex flex-col h-full">
      <div className={`border-b border-color flex justify-center py-5 ${dark ? "bg-slate-900/40" : "bg-white/60"}`}>
        <StepperBar current="preview" dark={!!dark} />
      </div>
      <div className="flex-1 p-8 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-base-color">Preview Data</h1>
            <p className="text-sm text-muted-color mt-0.5">Review your uploaded CSV data before AI mapping.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-color shrink-0">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#00463f]" />
              <span className="font-medium text-base-color">{files.length === 1 ? files[0].name : `${files.length} Files`}</span>
            </span>
            <span className="font-bold text-base-color">≡ {rawRows.length.toLocaleString()} Rows</span>
          </div>
        </div>

        <div className={`${cardCls} shadow-sm flex flex-col overflow-hidden flex-1 min-h-0`}>
          <div className="flex items-center gap-3 p-4 border-b border-color">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-color" />
              <input 
                type="text" 
                placeholder="Search preview data…" 
                value={search}
                onChange={handleSearchChange}
                className={inputCls} 
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-color rounded-lg hover-bg transition-all text-muted-color">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
          </div>

          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full min-w-max text-sm">
              <thead className={`sticky top-0 z-10 border-b border-color ${dark ? "bg-slate-800" : "bg-gray-50"}`}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color w-10">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color w-28">Validation</th>
                  {headers.map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-color whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? "divide-slate-700/50" : "divide-gray-50"}`}>
                {previewRows.map((row, i) => {
                  const globalIndex = (previewPage - 1) * TABLE_PAGE_SIZE + i;
                  return (
                    <PreviewRow 
                      key={globalIndex} 
                      row={row} 
                      index={globalIndex} 
                      headers={headers} 
                      dark={dark} 
                    />
                  );
                })}
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={headers.length + 2} className="px-5 py-10 text-center text-muted-color text-sm">
                      No records match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination 
            currentPage={previewPage}
            totalPages={totalPreviewPages}
            totalItems={filtered.length}
            pageSize={TABLE_PAGE_SIZE}
            onPageChange={setPreviewPage}
            dark={dark}
          />
        </div>

        <div className="flex items-center justify-between pt-2 shrink-0">
          <button 
            onClick={onCancel} 
            className="px-5 py-2.5 rounded-xl border border-color text-sm font-semibold text-base-color hover-bg transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff7948] text-white text-sm font-bold hover:bg-[#f06030] transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4 fill-current text-orange-200" /> Confirm &amp; Start AI Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
