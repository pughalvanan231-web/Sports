import { useEffect, useState } from "react";
import { Lock, ShieldCheck, KeyRound, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CORRECT_PIN = "1020";
const AUTH_STORAGE_KEY = "nexus_sports_pos_unlocked";

export function PinLockModal({
  onUnlocked,
}: {
  onUnlocked?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Allow physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleDigit = (digit: string) => {
    if (pin.length >= 4 || isSuccess) return;
    setError(false);
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      if (nextPin === CORRECT_PIN) {
        setIsSuccess(true);
        try {
          sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
        } catch {}
        setTimeout(() => {
          onUnlocked?.();
        }, 350);
      } else {
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 750);
      }
    }
  };

  const handleBackspace = () => {
    setError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(false);
    setPin("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 sm:p-8 text-center shadow-2xl text-white">
        {/* Lock Icon Header */}
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/20 mb-4">
          {isSuccess ? (
            <ShieldCheck className="size-8 text-emerald-400 animate-in zoom-in-75 duration-200" />
          ) : (
            <Lock className="size-8 text-blue-400" />
          )}
        </div>

        <h2 className="text-xl font-black tracking-tight text-white uppercase">
          Nexus Sports POS
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Enter 4-digit access PIN to unlock billing & inventory
        </p>

        {/* 4 PIN Dots / Input Boxes */}
        <div className="my-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = pin.length > index;
            return (
              <div
                key={index}
                className={cn(
                  "size-13 grid place-items-center rounded-2xl border-2 text-2xl font-black font-mono transition-all duration-150",
                  error
                    ? "border-red-500 bg-red-500/15 text-red-400 animate-shake"
                    : isSuccess
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                    : hasDigit
                    ? "border-blue-500 bg-blue-500/20 text-white shadow-sm shadow-blue-500/40"
                    : "border-slate-700 bg-slate-800/60 text-slate-500"
                )}
              >
                {hasDigit ? "•" : ""}
              </div>
            );
          })}
        </div>

        {/* Error / Success text */}
        <div className="h-6 mb-4 text-xs font-semibold">
          {error ? (
            <span className="text-red-400">Incorrect PIN. Try again.</span>
          ) : isSuccess ? (
            <span className="text-emerald-400">PIN Verified! Unlocking...</span>
          ) : (
            <span className="text-slate-500">Authorized Personnel Only</span>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-12 rounded-2xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white transition-all hover:bg-slate-700 active:scale-95 active:bg-blue-600 focus:outline-none"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-2xl border border-slate-800 bg-slate-900/60 text-xs font-bold text-slate-400 transition-all hover:bg-slate-800 hover:text-white active:scale-95 focus:outline-none"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-12 rounded-2xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white transition-all hover:bg-slate-700 active:scale-95 active:bg-blue-600 focus:outline-none"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-2xl border border-slate-800 bg-slate-900/60 text-sm font-bold text-slate-400 transition-all hover:bg-slate-800 hover:text-white active:scale-95 focus:outline-none"
            title="Backspace"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function lockSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.reload();
  } catch {}
}
