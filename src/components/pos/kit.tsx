import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import JsBarcode from "jsbarcode";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatCurrency, type Product, type Sale, type Settings, stockStatus } from "@/lib/store";

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-400 font-normal">{desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.02)]", className)}>
      {children}
    </div>
  );
}

const tones = {
  primary: "bg-blue-50 text-blue-700 border border-blue-100",
  success: "bg-emerald-50 text-emerald-600 border border-emerald-100/80",
  warning: "bg-amber-50 text-amber-600 border border-amber-100/80",
  danger: "bg-rose-50 text-rose-600 border border-rose-100/80",
  info: "bg-sky-50 text-sky-700 border border-sky-100/80",
  muted: "bg-slate-100/80 text-slate-600 border border-slate-200/60",
} as const;
export type Tone = keyof typeof tones;

export function StatCard({ label, value, icon: Icon, tone = "primary", hint }: { label: string; value: ReactNode; icon: LucideIcon; tone?: Tone; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className={cn("grid size-12 shrink-0 place-items-center rounded-xl", tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Pill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-tight", tones[tone])}>
      {children}
    </span>
  );
}

export function StockBadge({ p }: { p: Product }) {
  const s = stockStatus(p);
  if (s === "out") return <Pill tone="danger">Out of Stock</Pill>;
  if (s === "low") return <Pill tone="warning">Low Stock ({p.stock})</Pill>;
  return <Pill tone="success">In Stock</Pill>;
}

export function EmptyState({ icon: Icon, title, desc, action }: { icon: LucideIcon; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground"><Icon className="size-6" aria-hidden /></div>
      <p className="font-semibold">{title}</p>
      {desc && <p className="max-w-xs text-sm text-muted-foreground">{desc}</p>}
      {action}
    </div>
  );
}

export function Barcode({ value, height = 50, className }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const ok = /^[\x20-\x7E]+$/.test(value || "");
  useEffect(() => {
    if (ref.current && ok) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          fontSize: 12,
          margin: 4,
          background: "",
          lineColor: "currentColor",
        });
        // Defensive safeguard: remove any direct child background rect
        const first = ref.current.firstElementChild;
        if (first && first.tagName.toLowerCase() === "rect") {
          first.remove();
        }
      } catch { /* invalid */ }
    }
  }, [value, height, ok]);
  if (!ok) return <p className="text-sm text-muted-foreground">Enter or generate a barcode to preview</p>;
  return <svg ref={ref} className={cn("max-w-full text-foreground", className)} role="img" aria-label={`Barcode ${value}`} />;
}

/* ---------- Printing ---------- */
let printNode: ReactNode = null;
const pl = new Set<() => void>();
export function printContent(node: ReactNode) {
  printNode = node; pl.forEach((l) => l());
  setTimeout(() => window.print(), 120);
}
export function PrintArea() {
  const node = useSyncExternalStore((l) => { pl.add(l); return () => pl.delete(l); }, () => printNode, () => null);
  return <div id="print-area" aria-hidden>{node}</div>;
}

export function Receipt({ sale, settings, size }: { sale: Sale; settings: Settings; size?: "80mm" | "A4" }) {
  const s = size ?? settings.paperSize;
  return (
    <div className={cn("mx-auto space-y-2 text-foreground", s === "80mm" ? "receipt-80 max-w-[300px] font-mono text-xs" : "receipt-a4 text-sm")}>
      <div className="text-center">
        <p className="text-base font-bold">{settings.shopName}</p>
        <p>{settings.address}</p><p>Ph: {settings.phone} · GSTIN {settings.gstin}</p>
      </div>
      <div className="border-y border-dashed py-1">
        <p>Invoice: <b>{sale.invoiceNo}</b></p>
        <p>{new Date(sale.date).toLocaleString("en-IN")}</p>
        {sale.customerName && <p>Customer: {sale.customerName} {sale.customerPhone}</p>}
      </div>
      <table className="w-full">
        <thead><tr className="text-left"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Amt</th></tr></thead>
        <tbody>{sale.items.map((i) => (
          <tr key={i.productId}><td>{i.name}<br /><span className="opacity-70">@ {formatCurrency(i.price)}</span></td><td className="text-right align-top">{i.qty}</td><td className="text-right align-top">{formatCurrency(i.price * i.qty)}</td></tr>
        ))}</tbody>
      </table>
      <div className="space-y-0.5 border-t border-dashed pt-1">
        <Row k="Subtotal" v={formatCurrency(sale.subtotal)} />
        {sale.discount > 0 && <Row k="Discount" v={"-" + formatCurrency(sale.discount)} />}
        <Row k="Tax (GST)" v={formatCurrency(sale.tax)} />
        <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatCurrency(sale.total)}</span></div>
        <Row k="Paid via" v={sale.payment} />
      </div>
      <p className="border-t border-dashed pt-1 text-center">{settings.invoiceFooter}</p>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;

export function printLabels(p: Product, count: number) {
  printContent(
    <div className="label-sheet">
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        <div className="label" key={i}><b>{p.name}</b><Barcode value={p.barcode} height={36} /><b>{formatCurrency(p.price)}</b></div>
      ))}
    </div>,
  );
}

export { Button };
