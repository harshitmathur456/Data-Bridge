import React, { useState, useEffect } from 'react';
import { Database, Sun, Moon, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (name: string) => void;
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
}

const generateCaptcha = () => {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let captcha = "";
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return captcha;
};

export default function LoginScreen({ onLoginSuccess, dark, setDark }: LoginScreenProps) {
  const [loginName, setLoginName] = useState("");
  const [captchaVal, setCaptchaVal] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setCaptchaVal(generateCaptcha());
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
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
      onLoginSuccess(loginName);
    } catch (err: any) {
      setCaptchaError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const inputCls = `w-full pl-3 pr-4 py-2 text-sm rounded-lg border border-color input-bg focus:outline-none focus:ring-2 focus:ring-[#00463f]/30 transition-all text-base-color`;

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
