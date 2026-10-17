import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import JsBarcode from "jsbarcode";
import {
  CheckCircle2,
  FileText,
  Printer,
  Plus,
  Receipt as ReceiptIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function Barcode({
  value,
  height = 50,
  fontSize = 12,
  margin = 4,
  className,
}: {
  value: string;
  height?: number;
  fontSize?: number;
  margin?: number;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const ok = /^[\x20-\x7E]+$/.test(value || "");
  useEffect(() => {
    if (ref.current && ok) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          height,
          fontSize,
          margin,
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
  }, [value, height, fontSize, margin, ok]);
  if (!ok) return <p className="text-sm text-muted-foreground">Enter or generate a barcode to preview</p>;
  return <svg ref={ref} className={cn("max-w-full text-foreground", className)} role="img" aria-label={`Barcode ${value}`} />;
}

/* ---------- Indian Currency Number to Words ---------- */
export function numberToWordsINR(num: number): string {
  const n = Math.round(Math.abs(num));
  if (n === 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(v: number): string {
    if (v < 20) return a[v];
    const tens = b[Math.floor(v / 10)];
    const ones = v % 10 !== 0 ? " " + a[v % 10] : "";
    return tens + ones;
  }

  function convertThreeDigits(v: number): string {
    const hundred = Math.floor(v / 100);
    const rest = v % 100;
    let res = "";
    if (hundred > 0) res += a[hundred] + " Hundred";
    if (rest > 0) {
      if (res) res += " and ";
      res += convertTwoDigits(rest);
    }
    return res;
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let words = "";
  if (crore > 0) words += convertThreeDigits(crore) + " Crore ";
  if (lakh > 0) words += convertThreeDigits(lakh) + " Lakh ";
  if (thousand > 0) words += convertThreeDigits(thousand) + " Thousand ";
  if (remainder > 0) words += convertThreeDigits(remainder);

  return words.trim() + " Rupees Only";
}

/* ---------- Printing Isolation & Dynamic Page Sizing ---------- */
export type PrintSize = "58mm" | "80mm" | "A4" | "label";

let printNode: ReactNode = null;
const pl = new Set<() => void>();

export function setDynamicPageSize(size: PrintSize = "58mm") {
  if (typeof document === "undefined") return;
  let styleEl = document.getElementById("dynamic-print-page") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "dynamic-print-page";
    document.head.appendChild(styleEl);
  }

  if (size === "label") {
    // 2-inch thermal sticker label (50mm x 30mm / 2" x 1.2")
    styleEl.textContent = `
      @page {
        size: 50mm 30mm !important;
        margin: 0mm !important;
      }
      html, body {
        width: 50mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
  } else if (size === "58mm") {
    // 2-inch thermal POS roll (58mm continuous roll)
    styleEl.textContent = `
      @page {
        size: 58mm auto !important;
        margin: 0mm !important;
      }
      html, body {
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
  } else if (size === "80mm") {
    // 3-inch thermal POS roll (80mm continuous roll)
    styleEl.textContent = `
      @page {
        size: 80mm auto !important;
        margin: 0mm !important;
      }
      html, body {
        width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
  } else {
    // Standard A4 full sheet
    styleEl.textContent = `
      @page {
        size: A4 portrait !important;
        margin: 6mm 8mm !important;
      }
      html, body {
        width: 100% !important;
      }
    `;
  }
}

export function printContent(node: ReactNode, size: PrintSize = "58mm") {
  printNode = node;
  setDynamicPageSize(size);
  pl.forEach((l) => l());
  // Short timeout allows React portal to paint and SVGs/Barcodes to layout before browser captures print snapshot
  setTimeout(() => {
    window.print();
  }, 180);
}

import { createPortal } from "react-dom";

export function PrintArea() {
  const node = useSyncExternalStore(
    (l) => {
      pl.add(l);
      return () => pl.delete(l);
    },
    () => printNode,
    () => null
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onAfterPrint = () => {
      printNode = null;
      pl.forEach((l) => l());
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  if (!mounted || !node || typeof document === "undefined") return null;

  return createPortal(
    <div id="print-area" aria-hidden="false">
      {node}
    </div>,
    document.body
  );
}

/* ---------- Professional A4 Tax Invoice ---------- */
export function TaxInvoiceA4({ sale, settings }: { sale: Sale; settings: Settings }) {
  const isPaid = sale.status !== "refunded";
  const taxRate = settings.defaultTax || 18;
  const halfTax = (taxRate / 2).toFixed(1);
  const cgst = sale.tax / 2;
  const sgst = sale.tax / 2;
  const taxableValue = Math.max(0, sale.total - sale.tax);

  return (
    <div className="invoice-sheet receipt-a4 mx-auto w-full max-w-[800px] bg-white text-slate-900 p-8 sm:p-10 font-sans border border-slate-200 rounded-xl shadow-sm text-sm print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full">
      {/* Top Banner / Store Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-slate-900 text-white font-extrabold text-xl shadow-sm">
              NX
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">{settings.shopName}</h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sports & Athletic Equipment Store</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600 max-w-sm">
            {settings.address}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><b>Phone:</b> {settings.phone}</span>
            {settings.email && <span><b>Email:</b> {settings.email}</span>}
          </div>
          <p className="mt-1 text-xs font-mono font-bold text-slate-900">
            GSTIN / UIN: <span className="text-blue-700">{settings.gstin}</span>
          </p>
        </div>

        {/* Invoice Title & Quick Badges */}
        <div className="sm:text-right flex flex-col sm:items-end justify-between">
          <div className="inline-block rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-white shadow-sm">
            Tax Invoice
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-400 uppercase">Original For Recipient</p>

          <div className="mt-4 space-y-1 text-xs">
            <p className="text-slate-600">
              Invoice No: <b className="font-mono text-base font-black text-slate-950">{sale.invoiceNo}</b>
            </p>
            <p className="text-slate-600">
              Date: <b className="text-slate-900">{new Date(sale.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</b>
            </p>
            <p className="text-slate-600">
              Time: <b className="text-slate-900">{new Date(sale.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</b>
            </p>
            <div className="pt-1">
              <span className={cn(
                "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                isPaid ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
              )}>
                {isPaid ? "PAID · " + sale.payment : "REFUNDED"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Billing Details Card */}
      <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200/80">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Billed To (Customer Details)</p>
          <p className="mt-1 text-base font-bold text-slate-950">{sale.customerName || "Walk-in Customer"}</p>
          {sale.customerPhone && (
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              Contact: <b>+91 {sale.customerPhone}</b>
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">Retail Consumer · Counter Sale</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment & Tax Details</p>
          <p className="mt-1 text-xs text-slate-700">Mode of Payment: <b className="text-slate-950">{sale.payment}</b></p>
          <p className="mt-0.5 text-xs text-slate-700">State / Place of Supply: <b className="text-slate-950">Karnataka (Code: 29)</b></p>
          <p className="mt-0.5 text-xs text-slate-700">Tax Type: <b className="text-slate-950">Intra-State GST (CGST + SGST)</b></p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3">Item Description</th>
              <th className="py-2.5 px-3 text-center">HSN/SAC</th>
              <th className="py-2.5 px-3 text-right">Unit Rate</th>
              <th className="py-2.5 px-3 text-center">Qty</th>
              <th className="py-2.5 px-3 text-right">Taxable</th>
              <th className="py-2.5 px-3 text-center">GST</th>
              <th className="py-2.5 px-3 text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sale.items.map((item, idx) => {
              const itemTotal = item.price * item.qty;
              const itemTaxable = settings.taxInclusive ? (itemTotal / (1 + (item.tax || taxRate) / 100)) : itemTotal;
              return (
                <tr key={item.productId || idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-center font-medium text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-400">SKU: {item.productId.toUpperCase()}</p>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-600">9506</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-700">{formatCurrency(item.price)}</td>
                  <td className="py-3 px-3 text-center font-bold text-slate-900">{item.qty}</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-700">{formatCurrency(itemTaxable)}</td>
                  <td className="py-3 px-3 text-center font-medium text-slate-600">{item.tax || taxRate}%</td>
                  <td className="py-3 px-3 text-right font-extrabold text-slate-900">{formatCurrency(itemTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary & Tax Calculations */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-6 pt-4 border-t border-slate-200">
        {/* Left Side: Amount in Words + Terms */}
        <div className="sm:col-span-7 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Invoice Amount in Words</p>
            <p className="mt-1 text-xs font-bold text-slate-900 italic">
              {numberToWordsINR(sale.total)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/70 text-[11px] text-slate-600 space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-slate-700">Terms & Conditions:</p>
            <p>1. Goods once sold can be exchanged within 7 days with original invoice & tag intact.</p>
            <p>2. Prescribed manufacturer warranty applicable with this valid tax invoice.</p>
            <p>3. Subject to local jurisdiction only.</p>
          </div>

          <div className="pt-2">
            <Barcode value={sale.invoiceNo} height={32} className="opacity-80" />
            <p className="text-[10px] font-mono text-slate-400 mt-1">Verification Barcode: {sale.invoiceNo}</p>
          </div>
        </div>

        {/* Right Side: Totals Card */}
        <div className="sm:col-span-5 rounded-xl bg-slate-50/80 p-4 border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Gross):</span>
            <span className="font-semibold text-slate-900">{formatCurrency(sale.subtotal)}</span>
          </div>

          {sale.discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Discount Allowed:</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-600">
            <span>Taxable Value:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(taxableValue)}</span>
          </div>

          <div className="flex justify-between text-slate-600 border-t border-dashed border-slate-200 pt-1.5">
            <span>CGST ({halfTax}%):</span>
            <span className="font-medium text-slate-800">{formatCurrency(cgst)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>SGST ({halfTax}%):</span>
            <span className="font-medium text-slate-800">{formatCurrency(sgst)}</span>
          </div>

          <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-baseline text-slate-950">
            <div>
              <p className="text-sm font-black uppercase tracking-tight">Grand Total:</p>
              <p className="text-[10px] text-slate-500 font-normal">Inclusive of all taxes</p>
            </div>
            <p className="text-xl font-black text-slate-950 tracking-tight">
              {formatCurrency(sale.total)}
            </p>
          </div>

          <div className="pt-2 text-[11px] text-slate-600 border-t border-slate-200">
            <div className="flex justify-between">
              <span>Paid via:</span>
              <span className="font-bold text-slate-900">{sale.payment}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer & Signature Row */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-800">{settings.invoiceFooter || "Thank you for shopping with us! Play hard, stay fit."}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">This is a computer-generated tax invoice. No signature required.</p>
        </div>

        <div className="text-center sm:text-right">
          <div className="h-10"></div>
          <p className="border-t border-slate-400 pt-1 text-xs font-bold text-slate-900">Authorized Signatory</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase">{settings.shopName}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Professional 2-inch (58mm) Thermal Slip ---------- */
export function ThermalReceipt58({ sale, settings }: { sale: Sale; settings: Settings }) {
  const taxRate = settings.defaultTax || 18;
  const halfTax = (taxRate / 2).toFixed(1);
  const cgst = sale.tax / 2;
  const sgst = sale.tax / 2;

  return (
    <div className="thermal-receipt receipt-58 mx-auto w-[48mm] max-w-[48mm] bg-white text-black p-1 font-mono text-[9px] leading-tight print:mx-auto">
      {/* Store Header */}
      <div className="text-center pb-1 border-b border-black">
        <h2 className="text-[11px] font-black uppercase tracking-tight leading-tight">{settings.shopName}</h2>
        <p className="text-[7.5px] leading-tight mt-0.5">{settings.address}</p>
        <p className="text-[8px] font-semibold">Ph: {settings.phone}</p>
        <p className="text-[8px] font-bold">GSTIN: {settings.gstin}</p>
      </div>

      {/* Invoice Meta */}
      <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[8px]">
        <div className="flex justify-between font-bold">
          <span>INV: {sale.invoiceNo}</span>
          <span className="uppercase">{sale.payment}</span>
        </div>
        <div className="flex justify-between text-black/80 text-[7.5px]">
          <span>{new Date(sale.date).toLocaleDateString("en-IN")}</span>
          <span>{new Date(sale.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {sale.customerName && (
          <div className="truncate pt-0.5 text-[7.5px]">
            <span className="text-black/70">Cust: </span>
            <span className="font-bold">{sale.customerName}</span>
          </div>
        )}
      </div>

      {/* Item List Header */}
      <div className="flex justify-between text-[7.5px] font-black uppercase border-b border-black py-0.5">
        <span>ITEM</span>
        <span>QTY &nbsp; TOTAL</span>
      </div>

      {/* Items (2-line layout standard for 2-inch 58mm thermal receipts) */}
      <div className="divide-y divide-dashed divide-black/30 py-0.5">
        {sale.items.map((item) => (
          <div key={item.productId} className="py-1">
            <div className="font-bold leading-tight break-words text-[8.5px]">{item.name}</div>
            <div className="flex justify-between items-baseline text-[8px] mt-0.5">
              <span className="text-black/80">
                {item.qty} x {formatCurrency(item.price)}
              </span>
              <span className="font-bold text-[8.5px]">{formatCurrency(item.price * item.qty)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Financials Breakdown */}
      <div className="border-t border-black pt-1 space-y-0.5 text-[8px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between font-bold">
            <span>Discount:</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[7.5px] text-black/80">
          <span>CGST ({halfTax}%):</span>
          <span>{formatCurrency(cgst)}</span>
        </div>
        <div className="flex justify-between text-[7.5px] text-black/80">
          <span>SGST ({halfTax}%):</span>
          <span>{formatCurrency(sgst)}</span>
        </div>
        <div className="flex justify-between border-y-2 border-black py-0.5 text-[10.5px] font-black my-1">
          <span>NET TOTAL:</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        <div className="flex justify-between font-bold text-[8px]">
          <span>PAID VIA:</span>
          <span className="uppercase">{sale.payment}</span>
        </div>
      </div>

      {/* Barcode & Footer */}
      <div className="mt-2 pt-1 border-t border-dashed border-black text-center space-y-1">
        <div className="flex justify-center overflow-hidden">
          <Barcode value={sale.invoiceNo} height={20} fontSize={8} margin={1} className="max-w-[44mm]" />
        </div>
        <p className="text-[7.5px] font-bold leading-tight">{settings.invoiceFooter || "Thank you! Visit again."}</p>
        <p className="text-[7px] text-black/70">Exchange within 7 days with bill</p>
      </div>
    </div>
  );
}

/* ---------- Professional 80mm Thermal Slip ---------- */
export function ThermalReceipt80({ sale, settings }: { sale: Sale; settings: Settings }) {
  const taxRate = settings.defaultTax || 18;
  const halfTax = (taxRate / 2).toFixed(1);
  const cgst = sale.tax / 2;
  const sgst = sale.tax / 2;

  return (
    <div className="thermal-receipt receipt-80 mx-auto w-[76mm] max-w-[76mm] bg-white text-black p-3 font-mono text-[11px] leading-tight print:mx-auto">
      {/* Shop Header */}
      <div className="text-center pb-2 border-b border-black">
        <h2 className="text-sm font-extrabold uppercase tracking-tight">{settings.shopName}</h2>
        <p className="text-[10px] leading-snug mt-0.5">{settings.address}</p>
        <p className="text-[10px]">Ph: {settings.phone}</p>
        <p className="text-[10px] font-bold">GSTIN: {settings.gstin}</p>
      </div>

      {/* Invoice Meta */}
      <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
        <div className="flex justify-between font-bold">
          <span>INVOICE: {sale.invoiceNo}</span>
          <span>{sale.payment}</span>
        </div>
        <div className="flex justify-between text-black/80">
          <span>{new Date(sale.date).toLocaleDateString("en-IN")}</span>
          <span>{new Date(sale.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {sale.customerName && (
          <div className="flex justify-between pt-0.5">
            <span>Customer:</span>
            <span className="font-bold truncate max-w-[140px]">{sale.customerName}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full my-2 text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-black text-left font-bold">
            <th className="py-1">Item</th>
            <th className="py-1 text-center w-8">Qty</th>
            <th className="py-1 text-right w-14">Price</th>
            <th className="py-1 text-right w-14">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-black/30">
          {sale.items.map((item) => (
            <tr key={item.productId}>
              <td className="py-1 pr-1 font-semibold">
                {item.name}
              </td>
              <td className="py-1 text-center font-bold align-top">{item.qty}</td>
              <td className="py-1 text-right align-top">{formatCurrency(item.price)}</td>
              <td className="py-1 text-right font-bold align-top">{formatCurrency(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financials Breakdown */}
      <div className="border-t border-black pt-1.5 space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between font-bold">
            <span>Discount:</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[9px] text-black/80">
          <span>CGST ({halfTax}%):</span>
          <span>{formatCurrency(cgst)}</span>
        </div>
        <div className="flex justify-between text-[9px] text-black/80">
          <span>SGST ({halfTax}%):</span>
          <span>{formatCurrency(sgst)}</span>
        </div>
        <div className="flex justify-between border-y-2 border-black py-1 text-xs font-black">
          <span>NET PAYABLE:</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        <div className="flex justify-between font-bold pt-0.5">
          <span>PAID VIA:</span>
          <span className="uppercase">{sale.payment}</span>
        </div>
      </div>

      {/* Barcode & Footer */}
      <div className="mt-3 pt-2 border-t border-dashed border-black text-center space-y-1.5">
        <div className="flex justify-center">
          <Barcode value={sale.invoiceNo} height={28} className="max-w-[200px]" />
        </div>
        <p className="text-[9px] font-bold">{settings.invoiceFooter || "Thank you for your visit!"}</p>
        <p className="text-[8px] text-black/70">Exchange within 7 days with bill</p>
      </div>
    </div>
  );
}

/* ---------- Universal Receipt Component ---------- */
export function Receipt({
  sale,
  settings,
  size,
}: {
  sale: Sale;
  settings: Settings;
  size?: "58mm" | "80mm" | "A4";
}) {
  const chosenSize = size ?? settings.paperSize ?? "58mm";
  if (chosenSize === "A4") {
    return <TaxInvoiceA4 sale={sale} settings={settings} />;
  }
  if (chosenSize === "80mm") {
    return <ThermalReceipt80 sale={sale} settings={settings} />;
  }
  return <ThermalReceipt58 sale={sale} settings={settings} />;
}

/* ---------- 2-inch Thermal Barcode Label Print (Sticker & Roll) ---------- */
export function printLabels(
  p: Product,
  count: number,
  shopName?: string,
  mode: "sticker" | "roll" = "sticker",
) {
  if (mode === "roll") {
    // 2-inch thermal continuous roll format (58mm)
    printContent(
      <div className="label-print-roll" data-print-type="roll">
        {Array.from({ length: Math.max(1, count) }, (_, i) => (
          <div className="roll-label-item" key={i}>
            <div className="label-store">{shopName || "NEXUS SPORTS"}</div>
            <div className="label-name">{p.name}</div>
            <div className="label-barcode-wrap">
              <Barcode value={p.barcode} height={22} fontSize={9} margin={0} />
            </div>
            <div className="label-price-row">
              <span className="label-mrp-label">MRP:</span>
              <span className="label-price-val">{formatCurrency(p.price)}</span>
              <span className="label-tax-note">(Incl. of all taxes)</span>
            </div>
            {i < count - 1 && <div className="roll-tear-line" />}
          </div>
        ))}
      </div>,
      "58mm",
    );
  } else {
    // 2-inch thermal sticker label format (50mm x 30mm)
    printContent(
      <div className="label-print-sheet" data-print-type="label">
        {Array.from({ length: Math.max(1, count) }, (_, i) => (
          <div className="single-label-sticker" key={i}>
            <div className="label-store">{shopName || "NEXUS SPORTS"}</div>
            <div className="label-name">{p.name}</div>
            <div className="label-barcode-wrap">
              <Barcode value={p.barcode} height={18} fontSize={8} margin={0} />
            </div>
            <div className="label-price-row">
              <span className="label-mrp-label">MRP:</span>
              <span className="label-price-val">{formatCurrency(p.price)}</span>
              <span className="label-tax-note">(Incl. Tax)</span>
            </div>
          </div>
        ))}
      </div>,
      "label",
    );
  }
}

/* ---------- Professional Invoice View & Print Dialog ---------- */
export function InvoiceModal({
  open,
  onClose,
  sale,
  settings,
  onNewBill,
}: {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  settings: Settings;
  onNewBill?: () => void;
}) {
  const [format, setFormat] = useState<"58mm" | "80mm" | "A4">(settings.paperSize || "58mm");

  useEffect(() => {
    if (settings.paperSize) {
      setFormat(settings.paperSize);
    }
  }, [settings.paperSize, open]);

  if (!sale) return null;

  const isRefunded = sale.status === "refunded";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 space-y-0">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
                <span>Invoice {sale.invoiceNo}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isRefunded
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                  )}
                >
                  {isRefunded ? "Refunded" : `PAID · ${sale.payment}`}
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {new Date(sale.date).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {sale.customerName || "Walk-in Customer"}
              </p>
            </div>
          </div>

          {/* Format Switcher Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormat("58mm")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 transition-all",
                format === "58mm"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              2-inch (58mm) POS
            </button>
            <button
              type="button"
              onClick={() => setFormat("80mm")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 transition-all",
                format === "80mm"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              3-inch (80mm) POS
            </button>
            <button
              type="button"
              onClick={() => setFormat("A4")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 transition-all",
                format === "A4"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              A4 Invoice
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Live Bill Preview Frame */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4 px-2 my-2 bg-slate-100/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <div className="mx-auto flex justify-center">
            {format === "58mm" ? (
              <ThermalReceipt58 sale={sale} settings={settings} />
            ) : format === "80mm" ? (
              <ThermalReceipt80 sale={sale} settings={settings} />
            ) : (
              <TaxInvoiceA4 sale={sale} settings={settings} />
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Total Payable: <b className="text-base text-slate-950 dark:text-white font-black">{formatCurrency(sale.total)}</b>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => printContent(<Receipt sale={sale} settings={settings} size={format} />, format)}
              className="gap-2 text-xs font-bold h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25"
            >
              <Printer className="size-4" />
              Print {format === "58mm" ? "2-inch Bill (58mm)" : format === "80mm" ? "3-inch Slip (80mm)" : "A4 Tax Invoice"}
            </Button>

            {onNewBill && (
              <Button
                onClick={() => {
                  onClose();
                  onNewBill();
                }}
                className="gap-1.5 text-xs font-bold h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white"
                autoFocus
              >
                <Plus className="size-4" />
                New Bill (Ctrl+B)
              </Button>
            )}

            {!onNewBill && (
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-xs font-semibold h-10 rounded-xl"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Button };



