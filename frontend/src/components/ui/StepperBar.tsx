import React from 'react';
import { Check, UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Step } from '@shared/types';

interface StepperBarProps {
  current: Step;
  dark: boolean;
}

export function StepperBar({ current, dark }: StepperBarProps) {
  const steps = [
    { id: 'upload', label: 'Upload' },
    { id: 'preview', label: 'Preview' },
    { id: 'results', label: 'Results' }
  ];
  const order: Step[] = ['upload', 'preview', 'importing', 'results'];
  const idx = order.indexOf(current);

  const percentMap: Record<Step, number> = {
    upload: 33,
    preview: 66,
    importing: 85,
    results: 100
  };
  const pct = percentMap[current] || 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-0">
        {steps.map((s, i) => {
          const sIdx = order.indexOf(s.id as Step);
          const done = idx > sIdx;
          const active = s.id === current || (current === 'importing' && s.id === 'preview');
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <div className={`h-px w-16 mx-1 ${done || active ? "bg-brand" : dark ? "bg-slate-700" : "bg-gray-200"}`} />}
              <div className="flex flex-col items-center gap-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  done ? "bg-[#00463f] border-brand text-white"
                    : active ? `border-brand text-brand ${dark ? "bg-slate-800" : "bg-white"}`
                    : dark ? "border-slate-600 text-slate-500 bg-slate-800" : "border-gray-300 text-gray-400 bg-white"
                }`}>
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-[11px] font-semibold ${active || done ? "text-brand" : dark ? "text-slate-500" : "text-gray-400"}`}>{s.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="w-48 flex flex-col gap-1 items-center mt-1">
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-850" : "bg-gray-200"}`}>
          <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-brand">{pct}% Completed</span>
      </div>
    </div>
  );
}

interface TopNavProps {
  current: Step;
  dark: boolean;
  onUpload: () => void;
  onPreview: () => void;
  rawRowsCount: number;
}

export function TopNav({ current, dark, onUpload, onPreview, rawRowsCount }: TopNavProps) {
  const order: Step[] = ['upload', 'preview', 'importing', 'results'];
  const ci = order.indexOf(current);
  const items = [
    { id: 'upload' as Step, label: 'Upload', icon: UploadCloud, action: onUpload },
    { id: 'preview' as Step, label: 'Preview', icon: FileSpreadsheet, action: onPreview },
    { id: 'results' as Step, label: 'Results', icon: CheckCircle2, action: () => {} },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((item) => {
        const ii = order.indexOf(item.id);
        const active = item.id === current || (current === 'importing' && item.id === 'preview');
        const done = ci > ii;
        const clickable = item.id === 'upload' || (item.id === 'preview' && rawRowsCount > 0);
        return (
          <button 
            key={item.id} 
            onClick={clickable ? item.action : undefined} 
            disabled={!clickable && !active}
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all border ${
              active 
                ? "bg-brand text-white border-brand shadow-sm"
                : done 
                  ? `text-brand border-color ${dark ? "bg-slate-800/40 hover:bg-slate-800" : "bg-white hover:bg-gray-50"}`
                  : dark ? "text-slate-600 border-slate-850 bg-slate-900/20 cursor-default" : "text-gray-400 border-gray-100 bg-gray-50/50 cursor-default"
            }`}
          >
            {done && !active ? <Check className="h-4 w-4 shrink-0 text-brand" /> : <item.icon className="h-4 w-4 shrink-0" />}
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
