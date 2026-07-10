"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Papa from "papaparse";
import {
  UploadCloud, FileSpreadsheet, Sparkles, X, CheckCircle2,
  AlertTriangle, RefreshCw, Search, ArrowRight, Check,
  AlertCircle, Database, ChevronLeft, ChevronRight, Filter,
  Plus, Moon, Sun
} from "lucide-react";

type Step = "upload" | "preview" | "importing" | "results";
interface RawRow { [key: string]: string; }
interface CRMRecord {
  created_at?: string; name?: string; email?: string;
  country_code?: string; mobile_without_country_code?: string;
  company?: string; city?: string; state?: string; country?: string;
  lead_owner?: string;
  crm_status?: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE" | "";
  crm_note?: string;
  data_source?: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | "";
  possession_time?: string; description?: string;
}
interface SkippedRecord { row: RawRow; reason: string; }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Top progress bar (fixed, shown during import) ──────────────────────────
function TopProgressBar({ pct, visible }: { pct: number; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent">
      <div
        className="h-full progress-bar-animated rounded-r-full transition-all duration-500"
        style={{ width: `${Math.max(3, pct)}%` }}
      />
    </div>
  );
}

// ─── Step stepper bar ───────────────────────────────────────────────────────
function StepperBar({ current, dark }: { current: Step; dark: boolean }) {
  const steps = [{ id: "upload", label: "Upload" }, { id: "preview", label: "Preview" }, { id: "results", label: "Results" }];
  const order: Step[] = ["upload", "preview", "importing", "results"];
  const idx = order.indexOf(current);

  const percentMap = {
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
          const active = s.id === current || (current === "importing" && s.id === "preview");
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

      {/* Horizontal Progress Bar & Percentage */}
      <div className="w-48 flex flex-col gap-1 items-center mt-1">
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-850" : "bg-gray-200"}`}>
          <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-brand">{pct}% Completed</span>
      </div>
    </div>
  );
}

// ─── Side nav ───────────────────────────────────────────────────────────────
// ─── Top tab nav ────────────────────────────────────────────────────────────
function TopNav({ current, dark, onUpload, onPreview, rawRowsCount }: { current: Step; dark: boolean; onUpload: () => void; onPreview: () => void; rawRowsCount: number }) {
  const order: Step[] = ["upload", "preview", "importing", "results"];
  const ci = order.indexOf(current);
  const items = [
    { id: "upload" as Step, label: "Upload", icon: UploadCloud, action: onUpload },
    { id: "preview" as Step, label: "Preview", icon: FileSpreadsheet, action: onPreview },
    { id: "results" as Step, label: "Results", icon: CheckCircle2, action: () => {} },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((item) => {
        const ii = order.indexOf(item.id);
        const active = item.id === current || (current === "importing" && item.id === "preview");
        const done = ci > ii;
        const clickable = item.id === "upload" || (item.id === "preview" && rawRowsCount > 0);
        return (
          <button key={item.id} onClick={clickable ? item.action : undefined} disabled={!clickable && !active}
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all border ${
              active 
                ? "bg-brand text-white border-brand shadow-sm"
                : done 
                  ? `text-brand border-color ${dark ? "bg-slate-800/40 hover:bg-slate-800" : "bg-white hover:bg-gray-50"}`
                  : dark ? "text-slate-600 border-slate-850 bg-slate-900/20 cursor-default" : "text-gray-400 border-gray-100 bg-gray-50/50 cursor-default"
            }`}>
            {done && !active ? <Check className="h-4 w-4 shrink-0 text-brand" /> : <item.icon className="h-4 w-4 shrink-0" />}
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
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

const generateCaptcha = () => {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return captcha;
};

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [dark, setDark] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [captchaVal, setCaptchaVal] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [search, setSearch] = useState("");
  const [isDrag, setIsDrag] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [resultPage, setResultPage] = useState(1);
  const [resultTab, setResultTab] = useState<"imported" | "skipped">("imported");
  const [importedRecords, setImportedRecords] = useState<CRMRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<SkippedRecord[]>([]);
  const [supabaseSaved, setSupabaseSaved] = useState(false);
  const [aiEngine, setAiEngine] = useState("Local Mock Mapper");
  
  // Progress & Retry States
  const [batchProgress, setBatchProgress] = useState<{ n: number; status: "idle" | "running" | "done" | "error"; errorMsg?: string }[]>([]);
  const [failedChunks, setFailedChunks] = useState<{ chunk: RawRow[]; originalIndex: number }[]>([]);
  const [importingState, setImportingState] = useState<{ total: number; current: number; status: "idle" | "running" | "done" }>({ total: 0, current: 0, status: "idle" });
  
  // Incremental Parsing States
  const [isParsing, setIsParsing] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [totalRowsToParse, setTotalRowsToParse] = useState(0);

  const [logs, setLogs] = useState<string[]>([]);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [geminiLive, setGeminiLive] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const BATCH = 20; // 20 rows/batch as requested
  const PER_PAGE = 10;

  // Load login session & generate captcha on mount
  useEffect(() => {
    setCaptchaVal(generateCaptcha());
    const saved = localStorage.getItem("databridge_user");
    if (saved) {
      setLoginName(saved);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaptchaError(null);

    if (captchaInput.trim() !== captchaVal) {
      setCaptchaError("Incorrect Captcha! Please verify and try again.");
      setCaptchaInput("");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName, captchaInput }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Login submission failed");
      }

      localStorage.setItem("databridge_user", loginName);
      setIsLoggedIn(true);
    } catch (err: any) {
      setCaptchaError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Check backend health
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(() => {
        setServerOk(true);
        return fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [] }),
        });
      })
      .then(r => setGeminiLive(r.headers.get("X-Mock-AI") === "false"))
      .catch(() => { setServerOk(false); setGeminiLive(false); });
  }, [step]);

  // Batch progress percentage
  const progressPct = batchProgress.length
    ? (batchProgress.filter(p => p.status === "done" || p.status === "error").length / batchProgress.length) * 100
    : 0;

  const processFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".csv")) return alert("Only .csv files allowed.");
    setFile(f);
    setIsParsing(true);
    setParsedCount(0);
    setTotalRowsToParse(0);
    setRawRows([]);
    setHeaders([]);

    try {
      const text = await f.text();
      const lines = text.split(/\r\n|\n/).filter(line => line.trim());
      setTotalRowsToParse(lines.length > 1 ? lines.length - 1 : 0);
    } catch (err) {
      console.error("Error estimating lines:", err);
    }

    const parsed: RawRow[] = [];
    let fieldsDetected = false;

    Papa.parse(f, {
      header: true,
      skipEmptyLines: "greedy",
      step: (results) => {
        if (results.data) {
          parsed.push(results.data as RawRow);
          if (!fieldsDetected && results.meta?.fields) {
            setHeaders(results.meta.fields);
            fieldsDetected = true;
          }
          if (parsed.length % 25 === 0) {
            setRawRows([...parsed]);
          }
          setParsedCount(parsed.length);
        }
      },
      complete: () => {
        setRawRows(parsed);
        setParsedCount(parsed.length);
        setIsParsing(false);
        setPreviewPage(1);
      },
      error: e => {
        alert("Parse error: " + e.message);
        setFile(null);
        setIsParsing(false);
      },
    });
  }, []);

  const removeFile = () => { setFile(null); setHeaders([]); setRawRows([]); if (fileRef.current) fileRef.current.value = ""; };
  const reset = () => { 
    removeFile(); 
    setImportedRecords([]); 
    setSkippedRecords([]); 
    setSupabaseSaved(false); 
    setFailedChunks([]);
    setParsedCount(0);
    setTotalRowsToParse(0);
    setStep("upload"); 
  };

  const filtered = useMemo(() =>
    search ? rawRows.filter(r => Object.values(r).some(v => v.toLowerCase().includes(search.toLowerCase()))) : rawRows,
    [rawRows, search]);
  const previewRows = useMemo(() => filtered.slice((previewPage - 1) * PER_PAGE, previewPage * PER_PAGE), [filtered, previewPage]);
  const totalPreviewPages = Math.ceil(filtered.length / PER_PAGE);

  const rowMissingContact = (row: RawRow) => {
    const keys = Object.keys(row);
    const ek = keys.find(k => /email|mail/i.test(k));
    const pk = keys.find(k => /phone|mobile|contact|ph/i.test(k));
    return !(ek && row[ek]?.trim()) && !(pk && row[pk]?.trim());
  };

  const startImport = async () => {
    setStep("importing");
    setImportedRecords([]); setSkippedRecords([]); setLogs([]); setSupabaseSaved(false);
    setFailedChunks([]);
    
    const chunks: RawRow[][] = [];
    for (let i = 0; i < rawRows.length; i += BATCH) chunks.push(rawRows.slice(i, i + BATCH));
    
    setBatchProgress(chunks.map((_, i) => ({ n: i + 1, status: "idle" })));
    setImportingState({ total: chunks.length, current: 0, status: "running" });
    setLogs([`Starting import of ${rawRows.length} records across ${chunks.length} batch${chunks.length > 1 ? "es" : ""}…`]);

    let imp: CRMRecord[] = [], skip: SkippedRecord[] = [], engine = "Local Mock Mapper";

    for (let i = 0; i < chunks.length; i++) {
      const bn = i + 1;
      setImportingState(prev => ({ ...prev, current: bn }));
      const isFinalBatch = i === chunks.length - 1;
      setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "running" } : x));
      setLogs(p => [...p, `[Batch ${bn}/${chunks.length}] Mapping ${chunks[i].length} rows…`]);
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunks[i], fileName: file?.name, isFinalBatch: isFinalBatch && failedChunks.length === 0,
            allImported: isFinalBatch ? imp : undefined,
            allSkipped: isFinalBatch ? skip : undefined,
            totalRows: rawRows.length, aiEngine: engine,
          }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        
        if (data.failed) {
          setLogs(p => [...p, `[Batch ${bn}/${chunks.length}] ✗ Failed after 2 retries: ${data.error}`]);
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: data.error } : x));
          setFailedChunks(p => [...p, { chunk: chunks[i], originalIndex: i }]);
        } else {
          if (res.headers.get("X-Mock-AI") === "false") engine = "Gemini 2.0 Flash";
          imp = [...imp, ...(data.imported || [])];
          skip = [...skip, ...(data.skipped || [])];
          if (isFinalBatch && data.supabase_saved) {
            setSupabaseSaved(true);
            setLogs(p => [...p, `[Supabase] ✓ Saved — Session ID: ${data.session_id}`]);
          }
          setLogs(p => [...p, `[Batch ${bn}/${chunks.length}] ✓ Done — ${data.total_imported} imported, ${data.total_skipped} skipped`]);
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "done" } : x));
        }
      } catch (e: any) {
        setLogs(p => [...p, `[Batch ${bn}/${chunks.length}] ✗ Request error: ${e.message}`]);
        setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: e.message } : x));
        setFailedChunks(p => [...p, { chunk: chunks[i], originalIndex: i }]);
      }
    }
    
    setImportedRecords(imp); setSkippedRecords(skip); setAiEngine(engine);
    setImportingState(prev => ({ ...prev, status: "done" }));
    setResultPage(1); setResultTab("imported"); setStep("results");
  };

  const retryFailedBatches = async () => {
    if (failedChunks.length === 0) return;
    setStep("importing");
    setImportingState({ total: failedChunks.length, current: 0, status: "running" });
    setLogs(p => [...p, `Retrying ${failedChunks.length} failed batches…`]);

    const remainingFailed: { chunk: RawRow[]; originalIndex: number }[] = [];
    let imp = [...importedRecords];
    let skip = [...skippedRecords];
    let engine = aiEngine;

    // Reset progress statuses for the failed batches
    setBatchProgress(p => p.map(x => {
      const isFailed = failedChunks.some(f => f.originalIndex + 1 === x.n);
      return isFailed ? { ...x, status: "idle" as const, errorMsg: undefined } : x;
    }));

    for (let i = 0; i < failedChunks.length; i++) {
      const item = failedChunks[i];
      const bn = item.originalIndex + 1;
      setImportingState(prev => ({ ...prev, current: i + 1 }));
      setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "running" } : x));
      setLogs(p => [...p, `[Batch ${bn}] Retrying mapping ${item.chunk.length} rows…`]);

      const isFinalBatch = i === failedChunks.length - 1 && remainingFailed.length === 0;

      try {
        const res = await fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: item.chunk, fileName: file?.name, isFinalBatch,
            allImported: isFinalBatch ? imp : undefined,
            allSkipped: isFinalBatch ? skip : undefined,
            totalRows: rawRows.length, aiEngine: engine,
          }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        if (data.failed) {
          setLogs(p => [...p, `[Batch ${bn}] ✗ Failed again: ${data.error}`]);
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: data.error } : x));
          remainingFailed.push(item);
        } else {
          if (res.headers.get("X-Mock-AI") === "false") engine = "Gemini 2.0 Flash";
          imp = [...imp, ...(data.imported || [])];
          skip = [...skip, ...(data.skipped || [])];
          if (isFinalBatch && data.supabase_saved) {
            setSupabaseSaved(true);
            setLogs(p => [...p, `[Supabase] ✓ Saved — Session ID: ${data.session_id}`]);
          }
          setLogs(p => [...p, `[Batch ${bn}] ✓ Done (Retried) — ${data.total_imported} imported, ${data.total_skipped} skipped`]);
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "done" } : x));
        }
      } catch (e: any) {
        setLogs(p => [...p, `[Batch ${bn}] ✗ Request error on retry: ${e.message}`]);
        setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: e.message } : x));
        remainingFailed.push(item);
      }
    }

    setImportedRecords(imp); setSkippedRecords(skip); setAiEngine(engine);
    setFailedChunks(remainingFailed);
    setImportingState(prev => ({ ...prev, status: "done" }));
    setResultPage(1); setStep("results");
  };

  const paginatedImported = useMemo(() => importedRecords.slice((resultPage - 1) * PER_PAGE, resultPage * PER_PAGE), [importedRecords, resultPage]);
  const paginatedSkipped = useMemo(() => skippedRecords.slice((resultPage - 1) * PER_PAGE, resultPage * PER_PAGE), [skippedRecords, resultPage]);
  const totalResultPages = Math.ceil((resultTab === "imported" ? importedRecords.length : skippedRecords.length) / PER_PAGE);

  const crmBadge = (s?: string) => {
    if (s === "GOOD_LEAD_FOLLOW_UP") return "bg-emerald-100 text-emerald-700";
    if (s === "SALE_DONE") return "bg-blue-100 text-blue-700";
    if (s === "DID_NOT_CONNECT") return "bg-amber-100 text-amber-700";
    if (s === "BAD_LEAD") return "bg-red-100 text-red-700";
    return dark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500";
  };

  // ── Shared style strings ──
  const cardCls = `card border rounded-2xl`;
  const inputCls = `w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-color input-bg focus:outline-none focus:ring-2 focus:ring-[#00463f]/30 transition-all text-base-color`;
  const pageBtnCls = `h-7 w-7 flex items-center justify-center rounded-lg border border-color hover-bg disabled:opacity-40 transition-all`;

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${dark ? "bg-[#0f1117]" : "bg-[#eeede8]"} transition-colors duration-200 relative`}>
        <button
          onClick={() => setDark(d => !d)}
          aria-label="Toggle dark mode"
          className={`absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center transition-all ${dark ? "bg-slate-700 text-yellow-400 hover:bg-slate-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className={`w-full max-w-md p-8 rounded-2xl border border-color card shadow-xl flex flex-col gap-6`}>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-brand flex items-center justify-center shadow-md">
              <Database className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-display text-base-color tracking-tight mt-2">Welcome to DataBridge AI</h1>
            <p className="text-sm text-muted-color">Please verify your details to access the importer</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name-input" className="text-xs font-semibold text-muted-color">Full Name</label>
              <input
                id="name-input"
                type="text"
                required
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                placeholder="Enter your name"
                className={`${inputCls} py-2.5 px-3.5`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="captcha-input" className="text-xs font-semibold text-muted-color">Captcha Verification</label>
              <div className="flex gap-3 items-center">
                <div className={`flex-1 py-3 px-4 rounded-xl font-mono text-xl font-bold tracking-widest text-center select-none ${dark ? "bg-slate-800 text-emerald-400 border border-slate-700" : "bg-gray-100 text-[#00463f] border border-gray-200"} relative overflow-hidden`} style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.15)", letterSpacing: "6px" }}>
                  <div className="absolute inset-0 opacity-15 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,currentColor_8px,currentColor_10px)]" />
                  {captchaVal}
                </div>
                <button
                  type="button"
                  onClick={() => setCaptchaVal(generateCaptcha())}
                  className="p-3 rounded-xl border border-color hover-bg transition-colors text-muted-color active:scale-95"
                  title="Generate new captcha"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
              <input
                id="captcha-input"
                type="text"
                required
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value)}
                placeholder="Type the captcha above"
                className={`${inputCls} py-2.5 px-3.5 text-center font-mono tracking-widest`}
              />
            </div>

            {captchaError && (
              <div className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
                {captchaError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-md mt-2 disabled:opacity-50"
            >
              {isLoggingIn ? "Verifying..." : "Access Dashboard"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col page-bg">

      {/* ── Fixed top progress bar ── */}
      <TopProgressBar pct={progressPct} visible={step === "importing"} />

      {/* ── Header ── */}
      <header className={`sticky top-0 z-40 flex h-14 items-center justify-between px-5 border-b border-color sidebar-bg shadow-sm`} style={{ paddingTop: step === "importing" ? "4px" : undefined }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-[#00463f] flex items-center justify-center">
            <Database className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-brand text-lg font-display tracking-tight">DataBridge AI</span>
        </div>

        {/* Top tab nav */}
        <div className="flex-1 mx-6 flex justify-center">
          <TopNav current={step} dark={dark} onUpload={reset} onPreview={() => setStep("preview")} rawRowsCount={rawRows.length} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Backend / Gemini status */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {serverOk === false ? (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">⚠ Backend Offline</span>
            ) : serverOk && (
              <span className={`px-2.5 py-1 rounded-full font-semibold text-xs ${geminiLive ? "bg-purple-100 text-purple-700" : dark ? "bg-amber-900/30 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                {geminiLive ? "✦ Gemini Live" : "◌ Mock Mode"}
              </span>
            )}
          </div>

          {/* Importing: inline progress in header */}
          {step === "importing" && batchProgress.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className={`w-28 h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-700" : "bg-gray-200"}`}>
                <div className="h-full progress-bar-animated rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-muted-color">
                {batchProgress.filter(p => p.status === "done").length}/{batchProgress.length}
              </span>
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${dark ? "bg-slate-700 text-yellow-400 hover:bg-slate-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User Display & Logout */}
          {isLoggedIn && (
            <div className="flex items-center gap-2 border-l pl-3 border-color">
              <span className="hidden lg:inline text-xs font-semibold text-base-color">Hi, {loginName}</span>
              <button
                onClick={() => { localStorage.removeItem("databridge_user"); setIsLoggedIn(false); setLoginName(""); setCaptchaInput(""); }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border border-color hover-bg transition-all text-red-500`}
                title="Logout"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — Upload & Results */}


        <main className="flex-1 overflow-auto">

          {/* ═══════════════════ STEP 1: UPLOAD ═══════════════════ */}
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center min-h-full p-10">
              <div className="w-full max-w-xl">
                <h1 className="text-3xl font-bold font-display text-center mb-1.5 text-base-color">Upload your Data</h1>
                <p className="text-sm text-muted-color text-center mb-8">Drag and drop your CSV file to begin the intelligent import process.</p>

                {!file ? (
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
                    onDragLeave={() => setIsDrag(false)}
                    onDrop={e => { e.preventDefault(); setIsDrag(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileRef.current?.click()}
                    className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 flex flex-col items-center text-center card ${
                      isDrag ? "border-[#00463f] bg-[#00463f]/5" : "border-color hover:border-[#00463f]/60"
                    }`}
                  >
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
                    <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
                      <UploadCloud className="h-7 w-7 text-[#00463f]" />
                    </div>
                    <h3 className="text-lg font-bold text-base-color mb-1 font-display">Drag &amp; drop your CSV</h3>
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
                        <p className="font-semibold truncate font-display text-base-color">Parsing {file?.name}...</p>
                        <p className="text-xs text-[#00463f] font-semibold mt-0.5">
                          Parsed {parsedCount} {totalRowsToParse > 0 ? `of ${totalRowsToParse}` : ""} rows...
                        </p>
                      </div>
                    </div>
                    {totalRowsToParse > 0 && (
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
                        <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (parsedCount / totalRowsToParse) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`${cardCls} p-5 flex items-center gap-4 shadow-sm`}>
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${dark ? "bg-emerald-900/30" : "bg-emerald-50"}`}>
                      <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate font-display text-base-color">{file?.name}</p>
                      <p className="text-xs text-muted-color mt-0.5">{file ? (file.size / 1024).toFixed(1) : 0} KB · {rawRows.length.toLocaleString()} rows parsed</p>
                    </div>
                    <button onClick={removeFile} className="p-2 rounded-lg text-muted-color hover:bg-red-100 hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <button disabled={!file || isParsing} onClick={() => setStep("preview")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00463f] text-white text-sm font-semibold hover:bg-[#225e56] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue to Mapping <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 2: PREVIEW ═══════════════════ */}
          {step === "preview" && (
            <div className="flex flex-col h-full">
              <div className={`border-b border-color flex justify-center py-5 ${dark ? "bg-slate-900/40" : "bg-white/60"}`}>
                <StepperBar current={step} dark={dark} />
              </div>
              <div className="flex-1 p-8 flex flex-col gap-4 overflow-hidden">
                {/* Title row */}
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold font-display text-base-color">Preview Data</h1>
                    <p className="text-sm text-muted-color mt-0.5">Review your uploaded CSV data before AI mapping.</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-color shrink-0">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-[#00463f]" />
                      <span className="font-medium text-base-color">{file?.name}</span>
                    </span>
                    <span className="font-bold text-base-color">≡ {rawRows.length.toLocaleString()} Rows</span>
                  </div>
                </div>

                {/* Table card */}
                <div className={`${cardCls} shadow-sm flex flex-col overflow-hidden flex-1 min-h-0`}>
                  {/* Search bar */}
                  <div className={`flex items-center gap-3 p-4 border-b border-color`}>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-color" />
                      <input type="text" placeholder="Search preview data…" value={search}
                        onChange={e => { setSearch(e.target.value); setPreviewPage(1); }}
                        className={inputCls} />
                    </div>
                    <button className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-color rounded-lg hover-bg transition-all text-muted-color`}>
                      <Filter className="h-3.5 w-3.5" /> Filter
                    </button>
                  </div>

                  {/* Table */}
                  <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full min-w-max text-sm">
                      <thead className={`sticky top-0 z-10 border-b border-color ${dark ? "bg-slate-800" : "bg-gray-50"}`}>
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color w-10">#</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color w-28">Validation</th>
                          {headers.map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-color whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dark ? "divide-slate-700/50" : "divide-gray-50"}`}>
                        {previewRows.map((row, i) => {
                          const ri = (previewPage - 1) * PER_PAGE + i;
                          const bad = rowMissingContact(row);
                          return (
                            <tr key={i} className={`transition-colors ${bad ? dark ? "bg-amber-900/10" : "bg-amber-50/40" : ""} hover-bg`}>
                              <td className="px-5 py-3 text-xs text-muted-color">{ri + 1}</td>
                              <td className="px-5 py-3">
                                {bad
                                  ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Will Skip</span>
                                  : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><Check className="h-3 w-3" /> OK</span>}
                              </td>
                              {headers.map(h => (
                                <td key={h} className="px-5 py-3 max-w-[180px] truncate whitespace-nowrap text-base-color">
                                  {row[h]
                                    ? /email|mail/i.test(h) ? <span className="text-brand">{row[h]}</span> : row[h]
                                    : <span className="text-muted-color opacity-40">—</span>}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {previewRows.length === 0 && (
                          <tr><td colSpan={headers.length + 2} className="px-5 py-10 text-center text-muted-color text-sm">No records match your search.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className={`border-t border-color px-5 py-3 flex items-center justify-between text-xs ${dark ? "bg-slate-800/40" : "bg-gray-50"}`}>
                    <span className="text-brand font-medium">
                      Showing {filtered.length === 0 ? 0 : (previewPage - 1) * PER_PAGE + 1}–{Math.min(previewPage * PER_PAGE, filtered.length)} of {filtered.length.toLocaleString()} entries
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewPage(p => Math.max(p - 1, 1))} disabled={previewPage === 1} className={pageBtnCls}><ChevronLeft className="h-3.5 w-3.5 text-muted-color" /></button>
                      <span className="px-3 py-1 rounded-lg bg-brand text-white font-bold text-[11px]">{previewPage}</span>
                      <button onClick={() => setPreviewPage(p => Math.min(p + 1, totalPreviewPages))} disabled={previewPage === totalPreviewPages} className={pageBtnCls}><ChevronRight className="h-3.5 w-3.5 text-muted-color" /></button>
                    </div>
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-between pt-2 shrink-0">
                  <button onClick={reset} className={`px-5 py-2.5 rounded-xl border border-color text-sm font-semibold text-base-color hover-bg transition-all`}>Cancel</button>
                  <button onClick={startImport}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff7948] text-white text-sm font-bold hover:bg-[#f06030] transition-all shadow-sm">
                    <Sparkles className="h-4 w-4 fill-current text-orange-200" /> Confirm &amp; Start AI Mapping
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ STEP 3: IMPORTING ═══════════════════ */}
          {step === "importing" && (
            <div className="flex items-center justify-center min-h-full p-10">
              <div className="w-full max-w-lg flex flex-col gap-5">

                {/* Progress card */}
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

                  {/* Large progress bar */}
                  <div className={`w-full h-3 rounded-full overflow-hidden mb-3 ${dark ? "bg-slate-700" : "bg-gray-100"}`}>
                    <div className="h-full progress-bar-animated rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, progressPct)}%` }} />
                  </div>

                  {/* Batch pill grid */}
                  <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                    {batchProgress.map(b => (
                      <div key={b.n} title={b.status === "error" ? `Batch ${b.n} Failed: ${b.errorMsg || ""}` : `Batch ${b.n}`}
                        className={`h-2 w-6 rounded-full transition-all ${
                          b.status === "done" ? "bg-emerald-500"
                          : b.status === "running" ? "progress-bar-animated"
                          : b.status === "error" ? "bg-red-500 shadow-sm shadow-red-500/50"
                          : dark ? "bg-slate-700" : "bg-gray-200"
                        }`} />
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
          )}

          {/* ═══════════════════ STEP 4: RESULTS ═══════════════════ */}
          {step === "results" && (
            <div className="p-8 flex flex-col gap-6">
              {/* Header */}
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
                <button onClick={reset}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00463f] text-white text-sm font-semibold hover:bg-[#225e56] transition-all shadow-sm shrink-0">
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
                  <button onClick={retryFailedBatches} className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-sm shrink-0 active:scale-95">
                    <RefreshCw className="h-4 w-4" /> Retry Failed Batches
                  </button>
                </div>
              )}

              {/* Metric bento cards */}
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

              {/* Tabs */}
              <div className={`flex border-b border-color`}>
                {(["imported", "skipped"] as const).map(tab => (
                  <button key={tab} onClick={() => { setResultTab(tab); setResultPage(1); }}
                    className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${resultTab === tab ? "border-brand text-brand" : `border-transparent ${dark ? "text-slate-500" : "text-gray-400"} hover:text-gray-600`}`}>
                    {tab === "imported" ? `Imported Records (${importedRecords.length})` : `Skipped Rows (${skippedRecords.length})`}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className={`${cardCls} shadow-sm overflow-hidden flex flex-col`}>
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
                        {paginatedImported.map((r, i) => (
                          <tr key={i} className="hover-bg transition-colors">
                            <td className="px-5 py-3.5 text-brand font-mono text-xs font-semibold">CRM-{String((resultPage - 1) * PER_PAGE + i + 1).padStart(4, "0")}</td>
                            <td className="px-5 py-3.5 font-semibold text-base-color">{r.name || "—"}</td>
                            <td className="px-5 py-3.5 text-brand">{r.email || "—"}</td>
                            <td className="px-5 py-3.5 text-brand font-mono text-xs">
                              {r.country_code ? (
                                <span className="inline-flex items-center gap-1.5">
                                  {getCountryCode(r.country_code) ? (
                                    <img src={`https://flagcdn.com/w20/${getCountryCode(r.country_code)}.png`} alt="" className="w-4 h-[11px] object-cover rounded-[1px] shadow-sm" />
                                  ) : (
                                    <span className="text-sm">🌐</span>
                                  )}
                                  {r.country_code}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-muted-color font-mono text-xs">{r.mobile_without_country_code || "—"}</td>
                            <td className="px-5 py-3.5 text-base-color">{r.company || "—"}</td>
                            <td className="px-5 py-3.5 text-base-color">{r.city || "—"}</td>
                            <td className="px-5 py-3.5">
                              {r.crm_status
                                ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${crmBadge(r.crm_status)}`}>{r.crm_status.replace(/_/g, " ")}</span>
                                : <span className="text-muted-color opacity-40">—</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3 stroke-[2.5]" /> Synced
                              </span>
                            </td>
                          </tr>
                        ))}
                        {importedRecords.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-muted-color">No records were imported.</td></tr>}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full min-w-max text-sm">
                      <thead className={`border-b border-color ${dark ? "bg-slate-800" : "bg-gray-50"}`}>
                        <tr>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-color">Skip Reason</th>
                          {headers.map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-color">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dark ? "divide-slate-700/50" : "divide-gray-50"}`}>
                        {paginatedSkipped.map((s, i) => (
                          <tr key={i} className={`transition-colors ${dark ? "hover:bg-red-900/10" : "hover:bg-red-50/30"}`}>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                <AlertCircle className="h-3 w-3" /> {s.reason}
                              </span>
                            </td>
                            {headers.map(h => <td key={h} className="px-5 py-3.5 text-base-color max-w-[160px] truncate">{s.row[h] || <span className="text-muted-color opacity-40">—</span>}</td>)}
                          </tr>
                        ))}
                        {skippedRecords.length === 0 && <tr><td colSpan={headers.length + 1} className="px-5 py-10 text-center text-muted-color">No skipped records. 🎉</td></tr>}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Pagination */}
                <div className={`border-t border-color px-5 py-3 flex items-center justify-between text-xs ${dark ? "bg-slate-800/40" : "bg-gray-50"}`}>
                  <span className="text-brand font-medium">
                    Showing {(resultTab === "imported" ? importedRecords : skippedRecords).length === 0 ? "0"
                      : `${(resultPage - 1) * PER_PAGE + 1}–${Math.min(resultPage * PER_PAGE, (resultTab === "imported" ? importedRecords : skippedRecords).length)}`} of {(resultTab === "imported" ? importedRecords : skippedRecords).length.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setResultPage(p => Math.max(p - 1, 1))} disabled={resultPage === 1} className={pageBtnCls}><ChevronLeft className="h-3.5 w-3.5 text-muted-color" /></button>
                    <span className="px-3 py-1 rounded-lg bg-brand text-white font-bold text-[11px]">{resultPage}</span>
                    <button onClick={() => setResultPage(p => Math.min(p + 1, totalResultPages))} disabled={resultPage === totalResultPages} className={pageBtnCls}><ChevronRight className="h-3.5 w-3.5 text-muted-color" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
