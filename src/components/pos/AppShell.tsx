import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  DollarSign,
  Home,
  Loader2,
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
  const [q, setQ] = useState("");

  useEffect(() => {
    initStore();
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

  return (
    <div className="min-h-screen bg-[#f3f5f9] p-2 sm:p-4 md:p-6 lg:p-8 font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Floating Main Application Card */}
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-4rem)] max-w-[1720px] flex-col rounded-2xl md:rounded-[32px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        
        {/* Top Header Row with Logo & Controls */}
        <header className="flex h-16 sm:h-20 items-center justify-between border-b border-slate-100 px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            {/* Quixotic POS Logo Icon */}
            <div className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-sm shadow-blue-500/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="5" />
                <path d="M7 10h10" />
                <path d="M7 14h5" />
                <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-blue-600">Quixotic POS</span>
              <span className="ml-2 hidden text-xs font-medium text-slate-400 sm:inline">· {settings.shopName || "Sports Pro"}</span>
            </div>
          </Link>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <span aria-live="polite" className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 sm:flex">
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
              ) : null}
            </span>

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="grid size-10 place-items-center rounded-xl border border-slate-200/70 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              {settings.theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>
          </div>
        </header>

        {/* Content Body: Left Icon Rail + Main View Area */}
        <div className="flex flex-1 min-h-0">
          {/* Vertical Icon Rail */}
          <aside
            aria-label="Sidebar navigation"
            className="hidden md:flex w-20 shrink-0 flex-col items-center border-r border-slate-100 py-6"
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
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/35 ring-4 ring-blue-500/10"
                        : "text-slate-400 hover:bg-slate-100/80 hover:text-slate-700"
                    )}
                  >
                    <n.icon className="size-5 transition-transform duration-150 group-hover:scale-105" aria-hidden />
                    {/* Tooltip */}
                    <span className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md group-hover:block whitespace-nowrap">
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
    </div>
  );
}
