import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  DollarSign,
  Home,
  Loader2,
  Lock,
  Moon,
  Receipt,
  ScanBarcode,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from "lucide-react";
import { initStore, update, useDB, useSaveStatus } from "@/lib/store";
import { PrintArea } from "./kit";
import { PinLockModal, isSessionUnlocked, lockSession } from "./PinLockModal";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/", label: "Billing", icon: DollarSign },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/sales", label: "Sales & Cart", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const settings = useDB((d) => d.settings);
  const status = useSaveStatus();
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    setIsUnlocked(isSessionUnlocked());
  }, []);

  useEffect(() => {
    initStore();
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (path !== "/") navigate({ to: "/" });
        setTimeout(() => (document.getElementById("pos-search") as HTMLInputElement | null)?.focus(), 50);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        window.dispatchEvent(new Event("pos:new-bill"));
        if (path !== "/") navigate({ to: "/" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, navigate]);

  const toggleTheme = () =>
    update((d) => ({
      ...d,
      settings: { ...d.settings, theme: d.settings.theme === "dark" ? "light" : "dark" },
    }));

  const handleQuickNewBill = () => {
    window.dispatchEvent(new Event("pos:new-bill"));
    if (path !== "/") navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] dark:bg-[#090d16] p-1.5 sm:p-3 md:p-5 font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Floating Main Application Card */}
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] md:min-h-[calc(100vh-2.5rem)] max-w-[1780px] flex-col rounded-2xl md:rounded-[28px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-[0_12px_40px_rgb(0,0,0,0.04)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.4)] overflow-hidden">
        
        {/* Top Header Row with Logo & POS Workstation Controls */}
        <header className="flex h-16 sm:h-20 items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-4 sm:px-6 md:px-8 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md">
          {/* Logo & Terminal Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-[1.01]">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="5" />
                  <path d="M7 10h10" />
                  <path d="M7 14h5" />
                  <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tight text-slate-950 dark:text-white uppercase">{settings.shopName || "NEXUS SPORTS"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Terminal #1
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 hidden sm:block">
                  Enterprise Retail POS & GST Billing System
                </p>
              </div>
            </Link>
          </div>

          {/* Center Workstation Live Clock & Session Info */}
          <div className="hidden lg:flex items-center gap-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 px-4 py-1.5 shadow-sm">
            <div className="text-right">
              <p className="font-mono text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{timeStr || "--:--:--"}</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{dateStr || "Today"}</p>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="size-2 rounded-full bg-blue-500"></span>
              <span>Cash Register: <b>Open</b></span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick New Bill Button */}
            <button
              onClick={handleQuickNewBill}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
              title="Start a new bill (Ctrl+B)"
            >
              <span>+ New Bill</span>
              <kbd className="hidden md:inline rounded bg-blue-700 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-blue-100">Ctrl+B</kbd>
            </button>

            {/* Sync Status */}
            <span aria-live="polite" className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
              {status === "saving" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-blue-500" aria-hidden />
                  Saving…
                </>
              ) : status === "saved" ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden />
                  Synced
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-emerald-500"></span>
                  Ready
                </>
              )}
            </span>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="grid size-10 place-items-center rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-sm"
            >
              {settings.theme === "dark" ? <Sun className="size-4.5 text-amber-400" /> : <Moon className="size-4.5 text-slate-600" />}
            </button>

            {/* Lock Terminal Button */}
            <button
              type="button"
              onClick={() => {
                lockSession();
                setIsUnlocked(false);
              }}
              aria-label="Lock terminal"
              title="Lock Terminal"
              className="grid size-10 place-items-center rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-sm"
            >
              <Lock className="size-4" />
            </button>
          </div>
        </header>

        {/* Content Body: Left Icon Rail + Main View Area */}
        <div className="flex flex-1 min-h-0">
          {/* Vertical Navigation Rail */}
          <aside
            aria-label="Sidebar navigation"
            className="hidden md:flex w-20 shrink-0 flex-col items-center border-r border-slate-100 dark:border-slate-800/80 py-5 bg-white/50 dark:bg-[#0f172a]/50"
          >
            <nav className="flex flex-col items-center gap-3 w-full px-3">
              {NAV.map((n) => {
                const active = path === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    title={n.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative grid size-12 place-items-center rounded-2xl transition-all duration-200",
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/35 ring-4 ring-blue-500/15"
                        : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <n.icon className="size-5 transition-transform duration-150 group-hover:scale-105" aria-hidden />
                    {/* Tooltip */}
                    <span className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl bg-slate-900 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white shadow-xl group-hover:block whitespace-nowrap border border-slate-800 dark:border-slate-700">
                      {n.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden flex-col items-center gap-2 text-[10px] text-slate-400 xl:flex">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 font-semibold">Ctrl+B</span>
              <span>New Bill</span>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Main mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-label={n.label}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] text-slate-400",
              path === n.to && "text-blue-600 font-semibold"
            )}
          >
            <n.icon className="size-5" aria-hidden />
            <span className="truncate max-w-[50px]">{n.label}</span>
          </Link>
        ))}
      </nav>

      <PrintArea />
      <Toaster position="top-center" richColors />

      {/* 4-Digit Security PIN Lock Overlay (PIN: 1020) */}
      {!isUnlocked && (
        <PinLockModal onUnlocked={() => setIsUnlocked(true)} />
      )}
    </div>
  );
}
