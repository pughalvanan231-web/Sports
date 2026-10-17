import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  List,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  Receipt,
  Scan,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, InvoiceModal, Receipt as ReceiptDoc, StockBadge, printContent } from "@/components/pos/kit";
import { BarcodeScannerModal } from "@/components/pos/BarcodeScannerModal";
import { playScannerBeep } from "@/lib/scannerAudio";
import {
  computeTotals,
  formatCurrency,
  getDB,
  nextInvoiceNo,
  stockStatus,
  uid,
  update,
  useDB,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleItem,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    cust: typeof s["cust"] === "string" ? s["cust"] : undefined,
    phone: typeof s["phone"] === "string" ? s["phone"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing — Quixotic POS" },
      { name: "description", content: "Fast billing, barcode scanning and invoice checkout for sports stores." },
      { property: "og:title", content: "Billing — Quixotic POS" },
      { property: "og:description", content: "Fast billing, barcode scanning and invoice checkout for sports stores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

const PAYMENTS: PaymentMethod[] = ["Cash", "UPI", "Card", "Bank", "Credit"];

/**
 * Normalizes barcode or SKU string for 100% resilient matching
 * Removes invisible whitespace, carriage returns, newlines, dashes
 */
function normalizeCode(val: string | number | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/[\r\n\t\s\-_]/g, "")
    .toLowerCase();
}

function BillingPage() {
  const { cust, phone } = Route.useSearch();
  const products = useDB((d) => d.products);
  const customers = useDB((d) => d.customers);
  const settings = useDB((d) => d.settings);

  const [query, setQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cat, setCat] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [cartOpen, setCartOpen] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  // High-visibility state for immediate visual proof of scan
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    code: string;
    price: number;
    qtyInBill: number;
    time: string;
    warning?: string;
  } | null>(null);

  const [lastError, setLastError] = useState<string | null>(null);

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [cName, setCName] = useState(cust ?? "");
  const [cPhone, setCPhone] = useState(phone ?? "");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [cashTendered, setCashTendered] = useState<number | "">("");
  const [done, setDone] = useState<Sale | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cust !== undefined) setCName(cust);
    if (phone !== undefined) setCPhone(phone);
  }, [cust, phone]);

  const refocus = () => setTimeout(() => barcodeInputRef.current?.focus() || searchRef.current?.focus(), 50);

  useEffect(() => {
    refocus();
  }, []);

  useEffect(() => {
    const h = () => newBill();
    window.addEventListener("pos:new-bill", h);
    return () => window.removeEventListener("pos:new-bill", h);
  });

  const active = useMemo(() => products.filter((p) => p.active), [products]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(active.map((p) => p.category)))], [active]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter((p) => {
      const matchCat = cat === "All" || p.category === cat;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "in" && stockStatus(p) === "in") ||
        (statusFilter === "low" && stockStatus(p) === "low") ||
        (statusFilter === "out" && stockStatus(p) === "out");
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchCat && matchStatus && matchQuery;
    });
  }, [active, query, cat, statusFilter]);

  const lowStockCount = useMemo(() => active.filter((p) => stockStatus(p) === "low").length, [active]);
  const outOfStockCount = useMemo(() => active.filter((p) => stockStatus(p) === "out").length, [active]);
  const totalInventoryValue = useMemo(
    () => active.reduce((sum, p) => sum + p.price * Math.max(p.stock, 0), 0),
    [active]
  );

  const addToCart = useCallback((id: string, silent = false) => {
    const p = getDB().products.find((x) => x.id === id);
    if (!p) return;

    setCart((c) =>
      c.some((i) => i.productId === id)
        ? c.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { productId: p.id, name: p.name, price: p.price, qty: 1, tax: p.tax, cost: p.cost }]
    );

    playScannerBeep("success");
    if (!silent) toast.success(`Added ${p.name} to bill`, { duration: 1500 });
    setCartOpen(true);
    refocus();
  }, []);

  const setQty = (id: string, qty: number) => {
    setCart((c) =>
      qty <= 0 ? c.filter((i) => i.productId !== id) : c.map((i) => (i.productId === id ? { ...i, qty } : i))
    );
    refocus();
  };

  /**
   * Barcode Scanner Engine
   * Matches barcode, SKU, or ID with 100% resilient normalization.
   * Immediately plays retail beep, displays visual "SCANNED" banner, and adds item to bill!
   */
  const handleBarcodeScan = useCallback((inputCode: string): boolean => {
    const cleaned = inputCode.trim().replace(/[\r\n\t]/g, "");
    if (!cleaned) return false;

    const norm = normalizeCode(cleaned);

    // 1. Check in all active products
    let matched = products.find((p) => {
      const bNorm = normalizeCode(p.barcode);
      const sNorm = normalizeCode(p.sku);
      const idNorm = normalizeCode(p.id);
      return bNorm === norm || sNorm === norm || idNorm === norm;
    });

    // 2. If not matched exactly, check case-insensitive contains or name match
    if (!matched && cleaned.length >= 3) {
      matched = products.find(
        (p) =>
          normalizeCode(p.barcode).includes(norm) ||
          normalizeCode(p.sku).includes(norm) ||
          p.name.toLowerCase() === cleaned.toLowerCase()
      );
    }

    if (matched) {
      // Check if product is deactivated
      if (!matched.active) {
        playScannerBeep("error");
        setLastError(`Product "${matched.name}" is deactivated. Please reactivate it in Inventory.`);
        toast.error(`Product "${matched.name}" is deactivated in Inventory.`);
        return false;
      }

      // Check existing quantity in bill
      const currentQty = cart.find((i) => i.productId === matched.id)?.qty ?? 0;
      const nextQty = currentQty + 1;

      let warningText: string | undefined;
      if (matched.stock <= 0) {
        warningText = "Warning: Product marked as 0 in stock, but added to bill for customer.";
      }

      // Add to bill
      addToCart(matched.id, true);

      // Trigger realistic retail scanner sound
      playScannerBeep("success");

      // Set prominent "JUST SCANNED" banner for undeniable visual proof
      setLastScanned({
        name: matched.name,
        code: matched.barcode || matched.sku,
        price: matched.price,
        qtyInBill: nextQty,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        warning: warningText,
      });

      setLastError(null);

      toast.success(`⚡ SCANNED: ${matched.name} (${formatCurrency(matched.price)}) · ${nextQty} in bill`, {
        icon: "🏷️",
        duration: 3000,
      });

      setBarcodeInput("");
      setQuery("");
      return true;
    }

    // Product not found
    playScannerBeep("error");
    const errMsg = `Barcode / SKU "${cleaned}" not found in products catalog.`;
    setLastError(errMsg);
    toast.error(errMsg, { duration: 4000 });
    return false;
  }, [products, cart, addToCart]);

  /**
   * Global Hardware Barcode Gun Scanner Listener
   * Captures rapid scanner gun keystrokes even if cashier doesn't focus input
   */
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement;
      const isCustomerInput =
        activeEl?.id === "cust-name" || activeEl?.id === "cust-phone" || activeEl?.id === "discount";

      if (isCustomerInput) return;

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      // Reset buffer if delay between keys is longer than typical scanner gun (150ms)
      if (diff > 160 && activeEl?.id !== "pos-search" && activeEl?.id !== "barcode-scan-input") {
        buffer = "";
      }

      if (e.key === "Enter") {
        if (buffer.length >= 2) {
          const scanned = buffer.trim();
          buffer = "";
          const ok = handleBarcodeScan(scanned);
          if (ok) {
            e.preventDefault();
          }
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBarcodeScan]);

  const handleScanSubmit = () => {
    const code = barcodeInput.trim() || query.trim();
    if (!code) return;
    const ok = handleBarcodeScan(code);
    if (ok) {
      setBarcodeInput("");
      setQuery("");
    }
  };

  const totals = computeTotals(cart, discount, settings.taxInclusive);
  const suggestions =
    cName.length > 0 || cPhone.length > 0
      ? customers
          .filter(
            (c) =>
              (cName && c.name.toLowerCase().includes(cName.toLowerCase())) ||
              (cPhone && c.phone.includes(cPhone))
          )
          .slice(0, 4)
      : [];
  const exact = suggestions.some((s) => s.name === cName && s.phone === cPhone);

  function newBill() {
    setCart([]);
    setCName("");
    setCPhone("");
    setDiscount(0);
    setPayment("Cash");
    setCashTendered("");
    setDone(null);
    setLastScanned(null);
    setLastError(null);
    refocus();
    toast.info("Started new bill");
  }

  const checkout = () => {
    if (!cart.length) return;
    if (payment === "Credit" && !cPhone) {
      playScannerBeep("error");
      toast.error("Credit sales require a customer phone number");
      return;
    }
    const db = getDB();
    const sale: Sale = {
      id: uid(),
      invoiceNo: nextInvoiceNo(db),
      date: new Date().toISOString(),
      customerName: cName || "Walk-in Customer",
      customerPhone: cPhone,
      items: cart,
      ...totals,
      payment,
    };
    update((d) => {
      const customersNext =
        cPhone && !d.customers.some((c) => c.phone === cPhone)
          ? [...d.customers, { id: uid(), name: cName || "Customer", phone: cPhone, createdAt: sale.date }]
          : d.customers;
      return {
        ...d,
        sales: [...d.sales, sale],
        customers: customersNext,
        products: d.products.map((p) => {
          const it = cart.find((i) => i.productId === p.id);
          return it ? { ...p, stock: p.stock - it.qty } : p;
        }),
        movements: [
          ...d.movements,
          ...cart.map((i) => ({
            id: uid(),
            productId: i.productId,
            qty: -i.qty,
            reason: "Sale " + sale.invoiceNo,
            date: sale.date,
          })),
        ],
      };
    });
    playScannerBeep("success");
    setDone(sale);
  };

  const totalCartQty = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="space-y-6">
      {/* Page Header: Title + Subtitle + Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Billing</h1>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <Zap className="size-3 fill-emerald-500 text-emerald-500" />
              Scanner Ready
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400 font-normal">
            Scan barcodes, manage live cart and generate customer invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Barcode Scanner Button (Camera & Hardware Gun support) */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-all hover:bg-blue-100 hover:border-blue-300 active:scale-95"
            title="Open Camera Barcode Scanner"
          >
            <Camera className="size-4.5 text-blue-600" />
            <span>Camera Scanner</span>
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
              Live
            </span>
          </button>

          {/* Cart Drawer Trigger for mobile/desktop toggle */}
          <button
            type="button"
            onClick={() => setCartOpen(!cartOpen)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
              cart.length > 0
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <ShoppingCart className="size-4 text-blue-600" />
            <span>Bill ({totalCartQty})</span>
            {cart.length > 0 && (
              <span className="font-bold text-slate-900">· {formatCurrency(totals.total)}</span>
            )}
          </button>

          {/* "+ New Bill" Primary Button */}
          <button
            type="button"
            onClick={newBill}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>New Bill</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip: Exact 4-Column Layout from Screenshot */}
      <div className="flex flex-wrap items-center gap-8 sm:gap-14 border-b border-slate-100 pb-6 pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Products</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">{active.length}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Low Stock</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-500">{lowStockCount}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Out of Stock</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-red-500">{outOfStockCount}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {cart.length > 0 ? "Current Bill Total" : "Inventory Value"}
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {cart.length > 0 ? formatCurrency(totals.total) : formatCurrency(totalInventoryValue)}
          </p>
        </div>
      </div>

      {/* Dedicated Barcode Scanner Bar: Impossible to miss for high-speed cashier checkout */}
      <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30">
              <Barcode className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Barcode Quick Scanner</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <Zap className="size-3 fill-emerald-600 text-emerald-600" />
                  Auto-Detect Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Scan with handheld scanner gun, camera, or type product barcode/SKU below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-sm transition-all"
          >
            <Camera className="size-3.5 text-blue-600" />
            <span>Camera Scanner</span>
          </button>
        </div>

        {/* Quick Barcode Scan Input with Action Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScanSubmit();
          }}
          className="mt-3 flex gap-2"
        >
          <div className="relative flex-1">
            <Scan className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-blue-600" />
            <input
              id="barcode-scan-input"
              ref={barcodeInputRef}
              value={barcodeInput}
              autoComplete="off"
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Zap barcode with scanner gun, or type barcode / SKU (e.g. 1234)..."
              className="h-11 w-full rounded-xl border border-blue-300 bg-white pl-10 pr-20 text-sm font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="submit"
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Zap className="size-4" />
            <span>Scan & Add</span>
          </button>
        </form>
      </div>

      {/* Instant Visual Proof: "JUST SCANNED & ADDED" Banner */}
      {lastScanned && (
        <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-950 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
              <CheckCircle2 className="size-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-emerald-900">
                  ⚡ SCANNED & ADDED TO BILL!
                </span>
                <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  {lastScanned.qtyInBill} in current bill
                </span>
                <span className="text-xs text-slate-400 font-mono">at {lastScanned.time}</span>
              </div>
              <p className="text-xs text-emerald-900 mt-0.5 font-medium">
                Product: <b className="font-bold text-emerald-950">{lastScanned.name}</b> · Price:{" "}
                <b className="font-bold">{formatCurrency(lastScanned.price)}</b> · Barcode:{" "}
                <span className="font-mono bg-emerald-100 px-1 rounded">{lastScanned.code}</span>
              </p>
              {lastScanned.warning && (
                <p className="text-[11px] text-amber-700 font-semibold mt-0.5">{lastScanned.warning}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLastScanned(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error alert if barcode not found */}
      {lastError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4.5 text-red-600 shrink-0" />
            <span className="font-medium">{lastError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastError(null)}
            className="font-bold text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Search input with search icon & quick camera trigger */}
        <div className="relative w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="pos-search"
            ref={searchRef}
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleScanSubmit();
              }
            }}
            placeholder="Search products by name, SKU or barcode..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {/* Right Filter Selects & View Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">All Categories</option>
              {categories.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Status</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Toggle between Table View & Grid View */}
          <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "table" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
              )}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Catalog + Live Billing Checkout Drawer */}
      <div className={cn("grid gap-6 transition-all", cartOpen ? "xl:grid-cols-[1fr_390px] 2xl:grid-cols-[1fr_420px]" : "grid-cols-1")}>
        {/* Left Section: Catalog Table or Grid */}
        <section aria-label="Billing Catalog" className="min-w-0">
          {shown.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
              <EmptyState
                icon={PackageSearch}
                title="No products match your search"
                desc="Try adjusting your keywords, category, or status filter."
                action={
                  <Button
                    variant="outline"
                    className="mt-3 rounded-xl"
                    onClick={() => {
                      setQuery("");
                      setCat("All");
                      setStatusFilter("all");
                      refocus();
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : viewMode === "table" ? (
            /* Data Table: Exact Replica of Screenshot Table with Barcode Information */
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-4 py-4">SKU / Barcode</th>
                      <th className="px-4 py-4">Category</th>
                      <th className="px-4 py-4">Selling Price</th>
                      <th className="px-4 py-4">Stock</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((p) => {
                      const itemInCart = cart.find((i) => i.productId === p.id);
                      const isOutOfStock = p.stock <= 0;

                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "group transition-colors hover:bg-slate-50/70",
                            itemInCart && "bg-blue-50/30"
                          )}
                        >
                          {/* PRODUCT */}
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors block">
                              {p.name}
                            </span>
                          </td>

                          {/* SKU & BARCODE */}
                          <td className="px-4 py-4">
                            <p className="font-mono text-xs font-semibold text-slate-800">{p.sku}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Barcode className="size-3 text-slate-400" />
                                <span>{p.barcode || "No Barcode"}</span>
                              </span>
                              {p.barcode && (
                                <button
                                  type="button"
                                  onClick={() => handleBarcodeScan(p.barcode)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                  title="Test scan this barcode"
                                >
                                  ⚡ Scan
                                </button>
                              )}
                            </div>
                          </td>

                          {/* CATEGORY */}
                          <td className="px-4 py-4 text-slate-600">
                            {p.category}
                          </td>

                          {/* SELLING PRICE */}
                          <td className="px-4 py-4 font-bold text-slate-900">
                            {formatCurrency(p.price)}
                          </td>

                          {/* STOCK */}
                          <td className="px-4 py-4 text-slate-700 font-medium">
                            {p.stock}
                          </td>

                          {/* STATUS */}
                          <td className="px-4 py-4">
                            <StockBadge p={p} />
                          </td>

                          {/* ACTIONS */}
                          <td className="px-6 py-4 text-right">
                            {itemInCart ? (
                              <div className="inline-flex items-center rounded-lg border border-blue-200 bg-white shadow-sm">
                                <button
                                  type="button"
                                  aria-label={`Decrease ${p.name}`}
                                  onClick={() => setQty(p.id, itemInCart.qty - 1)}
                                  className="grid size-8 place-items-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-l-lg transition-colors"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <span className="w-8 text-center text-xs font-bold text-blue-600">
                                  {itemInCart.qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase ${p.name}`}
                                  onClick={() => setQty(p.id, itemInCart.qty + 1)}
                                  className="grid size-8 place-items-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-r-lg transition-colors"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(p.id)}
                                className={cn(
                                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                                  isOutOfStock
                                    ? "text-amber-700 hover:bg-amber-50 border border-amber-200"
                                    : "text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200"
                                )}
                              >
                                {isOutOfStock ? "+ Bill (0 Stock)" : "+ Add to Bill"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Grid View: Touch POS friendly cards */
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p.id, true)}
                    className={cn(
                      "group flex flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md",
                      inCart ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{p.category}</span>
                        <span className="font-mono">{p.sku}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 min-h-10 text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </p>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-base font-extrabold text-slate-900">{formatCurrency(p.price)}</p>
                        <div className="mt-1">
                          <StockBadge p={p} />
                        </div>
                      </div>

                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-xl text-white transition-transform group-hover:scale-105",
                          inCart ? "bg-blue-600" : "bg-slate-900 group-hover:bg-blue-600"
                        )}
                      >
                        <Plus className="size-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Section: Current Bill & Checkout Panel */}
        {cartOpen && (
          <aside aria-label="Current Bill" className="xl:sticky xl:top-6 xl:self-start">
            <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Receipt className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">Current Bill</h2>
                    <p className="text-xs text-slate-400">{totalCartQty} items in cart</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={newBill}
                  disabled={!cart.length}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                >
                  Clear Bill
                </button>
              </div>

              {/* Items List */}
              <ul className="max-h-[300px] min-h-[160px] divide-y divide-slate-100 overflow-y-auto px-4">
                {cart.length === 0 ? (
                  <li className="py-12 text-center">
                    <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                      <ScanBarcode className="size-6" />
                    </div>
                    <p className="mt-3 font-semibold text-slate-800">Bill is empty</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Scan product barcode or tap any item to add.
                    </p>
                  </li>
                ) : (
                  cart.map((i) => (
                    <li key={i.productId} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{i.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatCurrency(i.price)} × {i.qty} ={" "}
                          <span className="font-bold text-slate-800">{formatCurrency(i.price * i.qty)}</span>
                        </p>
                      </div>

                      <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          aria-label={`Decrease ${i.name}`}
                          onClick={() => setQty(i.productId, i.qty - 1)}
                          className="grid size-8 place-items-center text-slate-500 hover:bg-slate-100 rounded-l-lg transition-colors"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-900">{i.qty}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${i.name}`}
                          onClick={() => setQty(i.productId, i.qty + 1)}
                          className="grid size-8 place-items-center text-slate-500 hover:bg-slate-100 rounded-r-lg transition-colors"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove ${i.name}`}
                        onClick={() => setQty(i.productId, 0)}
                        className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {/* Checkout Form & Totals */}
              <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                {/* Customer Details */}
                <div className="relative grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="cust-name" className="text-xs font-semibold text-slate-500">
                      Customer
                    </label>
                    <input
                      id="cust-name"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder="Walk-in"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="cust-phone" className="text-xs font-semibold text-slate-500">
                      Phone
                    </label>
                    <input
                      id="cust-phone"
                      inputMode="tel"
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="10 digits"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Customer Autocomplete Dropdown */}
                  {suggestions.length > 0 && !exact && (
                    <ul
                      className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      role="listbox"
                    >
                      {suggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => {
                              setCName(c.name);
                              setCPhone(c.phone);
                              refocus();
                            }}
                            className="flex w-full justify-between px-3 py-2 text-xs hover:bg-slate-50 text-slate-700"
                          >
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-slate-400">{c.phone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Discount Row */}
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="discount" className="text-xs font-semibold text-slate-500">
                    Discount (₹)
                  </label>
                  <input
                    id="discount"
                    type="number"
                    min={0}
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Totals Summary */}
                <dl className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd className="font-medium text-slate-800">{formatCurrency(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-red-500 font-medium">
                      <dt>Discount</dt>
                      <dd>-{formatCurrency(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt>GST {settings.taxInclusive ? "(inclusive)" : ""}</dt>
                    <dd className="font-medium text-slate-800">{formatCurrency(totals.tax)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-slate-200/80 pt-2 text-slate-900">
                    <dt className="text-sm font-bold">Total Amount</dt>
                    <dd className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {formatCurrency(totals.total)}
                    </dd>
                  </div>
                </dl>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Payment method">
                    {PAYMENTS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={payment === m}
                        onClick={() => {
                          setPayment(m);
                          refocus();
                        }}
                        className={cn(
                          "min-h-9 rounded-xl border text-xs font-bold transition-all",
                          payment === m
                            ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Tendered & Change Return Calculator */}
                {payment === "Cash" && (
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="cash-tendered-input" className="font-semibold text-slate-600 dark:text-slate-300">Cash Received (₹)</label>
                      <input
                        id="cash-tendered-input"
                        type="number"
                        min={0}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={String(totals.total)}
                        className="h-8 w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-right text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setCashTendered(totals.total)}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashTendered(Math.ceil(totals.total / 500) * 500 || 500)}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        ₹{Math.ceil(totals.total / 500) * 500 || 500}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashTendered(Math.ceil(totals.total / 1000) * 1000 || 1000)}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        ₹{Math.ceil(totals.total / 1000) * 1000 || 1000}
                      </button>
                    </div>
                    {typeof cashTendered === "number" && cashTendered >= totals.total && (
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 rounded-lg px-2.5 py-1.5">
                        <span>Change to Return:</span>
                        <span className="text-sm font-black">{formatCurrency(cashTendered - totals.total)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Checkout Button */}
                <button
                  id="btn-checkout"
                  type="button"
                  onClick={checkout}
                  disabled={!cart.length}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Receipt className="size-4" />
                  <span>Checkout · {formatCurrency(totals.total)}</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Camera & Hardware Barcode Scanner Modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        products={active}
        onBarcodeScanned={handleBarcodeScan}
        cartCount={totalCartQty}
        cartTotal={totals.total}
      />

      {/* Professional Tax Invoice & Receipt Modal on Checkout Success */}
      <InvoiceModal
        open={!!done}
        onClose={() => newBill()}
        sale={done}
        settings={settings}
        onNewBill={newBill}
      />
    </div>
  );
}
