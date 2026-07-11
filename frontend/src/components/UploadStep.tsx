import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, Plus, Sparkles, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { UploadedFile, RawRow } from '@shared/types';

interface UploadStepProps {
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  onContinue: () => void;
  dark?: boolean;
}

export default function UploadStep({ files, setFiles, onContinue, dark }: UploadStepProps) {
  const [isDrag, setIsDrag] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingFileName, setParsingFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = async (incomingFiles: File[]) => {
    const csvFiles = incomingFiles.filter(f => f.name.endsWith('.csv'));
    if (csvFiles.length === 0) {
      if (incomingFiles.length > 0) alert('Only .csv files allowed.');
      return;
    }

    setIsParsing(true);
    
    for (const f of csvFiles) {
      if (files.some(existing => existing.name === f.name && existing.size === f.size)) {
        continue;
      }
      setParsingFileName(f.name);

      await new Promise<void>((resolve) => {
        Papa.parse(f, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            const rows = results.data as RawRow[];
            const fileHeaders = results.meta?.fields || [];
            const newUploaded: UploadedFile = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              name: f.name,
              size: f.size,
              rowsCount: rows.length,
              headers: fileHeaders,
              rows: rows
            };
            setFiles(prev => [...prev, newUploaded]);
            resolve();
          },
          error: (e) => {
            alert(`Error parsing ${f.name}: ${e.message}`);
            resolve();
          }
        });
      });
    }

    setIsParsing(false);
    setParsingFileName('');
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (fileRef.current) fileRef.current.value = '';
  };

  const cardCls = `card border rounded-2xl`;

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-full p-10"
      onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
      onDragLeave={() => setIsDrag(false)}
      onDrop={e => { e.preventDefault(); setIsDrag(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); }}
    >
      <div className="w-full max-w-xl relative">
        {isDrag && (
          <div className="absolute inset-0 bg-[#00463f]/10 border-2 border-dashed border-[#00463f] rounded-2xl flex items-center justify-center z-50 pointer-events-none backdrop-blur-sm">
            <div className="text-center">
              <UploadCloud className="h-12 w-12 text-[#00463f] mx-auto mb-2 animate-bounce" />
              <p className="font-bold text-[#00463f]">Drop CSV files here!</p>
            </div>
          </div>
        )}
        <h1 className="text-3xl font-bold font-display text-center mb-1.5 text-base-color">Upload your Data</h1>
        <p className="text-sm text-muted-color text-center mb-8">Drag and drop one or more CSV files to begin the intelligent import process.</p>

        {files.length === 0 && !isParsing ? (
          <div
            onClick={() => fileRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 flex flex-col items-center text-center card border-color hover:border-[#00463f]/60`}
          >
            <input ref={fileRef} type="file" accept=".csv" multiple className="hidden" onChange={e => e.target.files && processFiles(Array.from(e.target.files))} />
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
              <UploadCloud className="h-7 w-7 text-[#00463f]" />
            </div>
            <h3 className="text-lg font-bold text-base-color mb-1 font-display">Drag &amp; drop your CSV files</h3>
            <p className="text-sm text-muted-color mb-6">or click to browse from your computer</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5 fill-current" /> AI Parsing Enabled
            </span>
          </div>
        ) : isParsing ? (
          <div className={`${cardCls} p-5 flex flex-col gap-3 shadow-sm`}>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/20">
                <div className="h-5 w-5 rounded-full border-2 border-emerald-600/20 border-t-emerald-600 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate font-display text-base-color">Parsing {parsingFileName}...</p>
                <p className="text-xs text-[#00463f] font-semibold mt-0.5">Please wait while the file is processed...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input ref={fileRef} type="file" accept=".csv" multiple className="hidden" onChange={e => e.target.files && processFiles(Array.from(e.target.files))} />
            {files.map(f => (
              <div key={f.id} className={`${cardCls} p-4 flex items-center gap-4 shadow-sm`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${dark ? "bg-emerald-900/30" : "bg-emerald-50"}`}>
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate font-display text-sm text-base-color">{f.name}</p>
                  <p className="text-[11px] text-muted-color mt-0.5">{(f.size / 1024).toFixed(1)} KB · {f.rowsCount.toLocaleString()} rows</p>
                </div>
                <button onClick={() => removeFile(f.id)} className="p-2 rounded-lg text-muted-color hover:bg-red-100 hover:text-red-500 transition-colors" title="Remove file">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed border-color hover:border-[#00463f]/60 transition-all p-4 flex items-center justify-center gap-2 hover-bg`}
            >
              <Plus className="h-4 w-4 text-[#00463f]" />
              <span className="text-xs font-semibold text-base-color">Add another CSV file</span>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button 
            disabled={files.length === 0 || isParsing} 
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00463f] text-white text-sm font-semibold hover:bg-[#225e56] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Mapping <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
