"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Database, Moon, Sun } from "lucide-react";
import { Step, UploadedFile, CRMRecord, SkippedRecord, RawRow } from "@shared/types";
import { IMPORT_BATCH_SIZE } from "@shared/constants";

// Import Components
import LoginScreen from "@/components/LoginScreen";
import UploadStep from "@/components/UploadStep";
import PreviewStep from "@/components/PreviewStep";
import ImportingStep from "@/components/ImportingStep";
import ResultsStep from "@/components/ResultsStep";
import { TopNav } from "@/components/ui/StepperBar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [dark, setDark] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const rawRows = useMemo(() => files.flatMap(f => f.rows), [files]);
  const headers = useMemo(() => {
    const allHeaders = new Set<string>();
    files.forEach(f => f.headers.forEach(h => allHeaders.add(h)));
    return Array.from(allHeaders);
  }, [files]);

  const [importedRecords, setImportedRecords] = useState<CRMRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<SkippedRecord[]>([]);
  const [supabaseSaved, setSupabaseSaved] = useState(false);
  const [aiEngine, setAiEngine] = useState("Local Mock Mapper");
  
  // Progress & Retry States
  const [batchProgress, setBatchProgress] = useState<{ n: number; status: "idle" | "running" | "done" | "error"; errorMsg?: string }[]>([]);
  const [failedChunks, setFailedChunks] = useState<{ chunk: RawRow[]; originalIndex: number }[]>([]);
  const [importingState, setImportingState] = useState<{ total: number; current: number; status: "idle" | "running" | "done" }>({ total: 0, current: 0, status: "idle" });

  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [geminiLive, setGeminiLive] = useState<boolean | null>(null);

  // Load login session on mount
  useEffect(() => {
    const saved = localStorage.getItem("databridge_user");
    if (saved) {
      setLoginName(saved);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSuccess = (name: string) => {
    setLoginName(name);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("databridge_user");
    setIsLoggedIn(false);
    setLoginName("");
  };

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Check backend health — Mount-only to prevent duplicate fetches on step changes
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(() => {
        setServerOk(true);
        return fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [] }),
        });
      })
      .then(r => setGeminiLive(r.headers.get("X-Mock-AI") === "false"))
      .catch(() => { 
        setServerOk(false); 
        setGeminiLive(false); 
      });
  }, []);

  // Batch progress percentage
  const progressPct = useMemo(() => {
    if (batchProgress.length === 0) return 0;
    const completedCount = batchProgress.filter(p => p.status === "done" || p.status === "error").length;
    return (completedCount / batchProgress.length) * 100;
  }, [batchProgress]);

  const reset = useCallback(() => { 
    setFiles([]);
    setImportedRecords([]); 
    setSkippedRecords([]); 
    setSupabaseSaved(false); 
    setFailedChunks([]);
    setStep("upload"); 
  }, []);

  const startImport = async () => {
    setStep("importing");
    setImportedRecords([]); 
    setSkippedRecords([]); 
    setSupabaseSaved(false);
    setFailedChunks([]);
    
    const chunks: RawRow[][] = [];
    for (let i = 0; i < rawRows.length; i += IMPORT_BATCH_SIZE) {
      chunks.push(rawRows.slice(i, i + IMPORT_BATCH_SIZE));
    }
    
    setBatchProgress(chunks.map((_, i) => ({ n: i + 1, status: "idle" })));
    setImportingState({ total: chunks.length, current: 0, status: "running" });

    let imp: CRMRecord[] = [];
    let skip: SkippedRecord[] = [];
    let engine = "Local Mock Mapper";

    for (let i = 0; i < chunks.length; i++) {
      const bn = i + 1;
      setImportingState(prev => ({ ...prev, current: bn }));
      const isFinalBatch = i === chunks.length - 1;
      setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "running" } : x));
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunks[i], 
            fileName: files.map(f => f.name).join(", "), 
            isFinalBatch: isFinalBatch && failedChunks.length === 0,
            allImported: isFinalBatch ? imp : undefined,
            allSkipped: isFinalBatch ? skip : undefined,
            totalRows: rawRows.length, 
            aiEngine: engine,
          }),
        });

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const data = await res.json();
        
        if (data.failed) {
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: data.error } : x));
          setFailedChunks(p => [...p, { chunk: chunks[i], originalIndex: i }]);
        } else {
          if (res.headers.get("X-Mock-AI") === "false") engine = "Gemini 2.0 Flash";
          imp = [...imp, ...(data.imported || [])];
          skip = [...skip, ...(data.skipped || [])];
          if (isFinalBatch && data.supabase_saved) {
            setSupabaseSaved(true);
          }
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "done" } : x));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: msg } : x));
        setFailedChunks(p => [...p, { chunk: chunks[i], originalIndex: i }]);
      }
    }
    
    setImportedRecords(imp); 
    setSkippedRecords(skip); 
    setAiEngine(engine);
    setImportingState(prev => ({ ...prev, status: "done" }));
    setStep("results");
  };

  const retryFailedBatches = async () => {
    if (failedChunks.length === 0) return;
    setStep("importing");
    setImportingState({ total: failedChunks.length, current: 0, status: "running" });

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

      const isFinalBatch = i === failedChunks.length - 1 && remainingFailed.length === 0;

      try {
        const res = await fetch(`${API_BASE_URL}/api/import`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: item.chunk, 
            fileName: files.map(f => f.name).join(", "), 
            isFinalBatch,
            allImported: isFinalBatch ? imp : undefined,
            allSkipped: isFinalBatch ? skip : undefined,
            totalRows: rawRows.length, 
            aiEngine: engine,
          }),
        });

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const data = await res.json();

        if (data.failed) {
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: data.error } : x));
          remainingFailed.push(item);
        } else {
          if (res.headers.get("X-Mock-AI") === "false") engine = "Gemini 2.0 Flash";
          imp = [...imp, ...(data.imported || [])];
          skip = [...skip, ...(data.skipped || [])];
          if (isFinalBatch && data.supabase_saved) {
            setSupabaseSaved(true);
          }
          setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "done" } : x));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setBatchProgress(p => p.map(x => x.n === bn ? { ...x, status: "error", errorMsg: msg } : x));
        remainingFailed.push(item);
      }
    }

    setImportedRecords(imp); 
    setSkippedRecords(skip); 
    setAiEngine(engine);
    setFailedChunks(remainingFailed);
    setImportingState(prev => ({ ...prev, status: "done" }));
    setStep("results");
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess} 
        dark={dark} 
        setDark={setDark} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col page-bg">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-5 border-b border-color sidebar-bg shadow-sm">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-[#00463f] flex items-center justify-center">
            <Database className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-brand text-lg font-display tracking-tight">DataBridge AI</span>
        </div>

        <div className="flex-1 mx-6 flex justify-center">
          <TopNav 
            current={step} 
            dark={dark} 
            onUpload={reset} 
            onPreview={() => setStep("preview")} 
            rawRowsCount={rawRows.length} 
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {serverOk === false ? (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold animate-pulse">⚠ Backend Offline</span>
            ) : serverOk && (
              <span className={`px-2.5 py-1 rounded-full font-semibold text-xs ${geminiLive ? "bg-purple-100 text-purple-700" : dark ? "bg-amber-900/30 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                {geminiLive ? "✦ Gemini Live" : "◌ Mock Mode"}
              </span>
            )}
          </div>

          <button
            onClick={() => setDark(d => !d)}
            aria-label="Toggle dark mode"
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${dark ? "bg-slate-700 text-yellow-400 hover:bg-slate-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {isLoggedIn && (
            <div className="flex items-center gap-2 border-l pl-3 border-color">
              <span className="hidden lg:inline text-xs font-semibold text-base-color">Hi, {loginName}</span>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-color hover-bg transition-all text-red-500"
                title="Logout"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto">
          {step === "upload" && (
            <UploadStep 
              files={files} 
              setFiles={setFiles} 
              onContinue={() => setStep("preview")} 
              dark={dark} 
            />
          )}

          {step === "preview" && (
            <PreviewStep 
              files={files} 
              rawRows={rawRows} 
              headers={headers} 
              onCancel={reset} 
              onConfirm={startImport} 
              dark={dark} 
            />
          )}

          {step === "importing" && (
            <ImportingStep 
              failedChunks={failedChunks} 
              importingState={importingState} 
              batchProgress={batchProgress} 
              progressPct={progressPct} 
              dark={dark} 
            />
          )}

          {step === "results" && (
            <ResultsStep 
              importedRecords={importedRecords} 
              skippedRecords={skippedRecords} 
              failedChunks={failedChunks} 
              supabaseSaved={supabaseSaved} 
              aiEngine={aiEngine} 
              headers={headers} 
              reset={reset} 
              retryFailedBatches={retryFailedBatches} 
              dark={dark} 
            />
          )}
        </main>
      </div>
    </div>
  );
}
