import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpDown, Boxes, IndianRupee, PackageX, Pencil, Plus, Printer, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Barcode, EmptyState, PageHeader, Panel, StatCard, StockBadge, printLabels } from "@/components/pos/kit";
import { DEFAULT_SPORTS_CATEGORIES, formatCurrency, genBarcode, stockStatus, uid, update, useDB, type Product } from "@/lib/store";

export const Route = createFileRoute("/inventory")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : undefined }),
  head: () => ({
    meta: [
      { title: "Inventory — Nexus Sports POS" },
      { name: "description", content: "Manage sports products, stock levels and barcode labels." },
      { property: "og:title", content: "Inventory — Nexus Sports POS" },
      { property: "og:description", content: "Manage sports products, stock levels and barcode labels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inventory,
});

type SortKey = "name" | "price" | "stock" | "category";
const field = "h-11 w-full rounded-lg border bg-background px-3 text-sm";

function Inventory() {
  const { q: initialQ } = Route.useSearch();
  const products = useDB((d) => d.products);
  const [q, setQ] = useState(initialQ ?? "");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "name", dir: 1 });
  const [editing, setEditing] = useState<Product | null>(null);
  const [labelFor, setLabelFor] = useState<Product | null>(null);

  const active = products.filter((p) => p.active);
  const cats = useMemo(() => {
    const existing = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_SPORTS_CATEGORIES, ...existing]));
  }, [products]);
  const rows = useMemo(() => products
    .filter((p) => (status === "inactive" ? !p.active : p.active))
    .filter((p) => cat === "All" || p.category === cat)
    .filter((p) => ["all", "inactive"].includes(status) || stockStatus(p) === status)
    .filter((p) => { const s = q.toLowerCase(); return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s); })
    .sort((a, b) => (a[sort.k] > b[sort.k] ? 1 : -1) * sort.dir), [products, q, cat, status, sort]);

  const blank = (): Product => ({ id: "", name: "", sku: "", barcode: "", category: "Cricket", price: 0, cost: 0, tax: 18, stock: 0, lowStock: 5, active: true });
  const th = (k: SortKey, label: string, cls = "") => (
    <th className={"px-4 py-3.5 " + cls}>
      <button
        className="inline-flex items-center gap-1 font-bold text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-wider text-[11px]"
        onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}
      >
        {label}
        <ArrowUpDown className="size-3" aria-hidden />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Page Header: Inventory + Subtitle + "+ Add Product" Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-400 font-normal">
            Manage products and stock.
          </p>
        </div>

        <button
          onClick={() => setEditing(blank())}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
        >
          <Plus className="size-4 stroke-[2.5]" />
          <span>Add Product</span>
        </button>
      </div>

      {/* KPI Metrics Strip: Exact 4-Column Layout from Screenshot */}
      <div className="flex flex-wrap items-center gap-8 sm:gap-14 border-b border-slate-100 pb-6 pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Products</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">{active.length}</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Low Stock</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-500">
            {active.filter((p) => stockStatus(p) === "low").length}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Out of Stock</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-red-500">
            {active.filter((p) => stockStatus(p) === "out").length}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory Value</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(active.reduce((s, p) => s + p.price * Math.max(p.stock, 0), 0))}
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Search input with search icon */}
        <div className="relative w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="inv-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {/* Right Filter Selects */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              id="inv-cat"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">All Categories</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>

          <div className="relative">
            <select
              id="inv-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Status</option>
              <option value="in">In Stock</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
              <option value="inactive">Deactivated</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>
        </div>
      </div>

      {/* Main Table: Exact Screenshot Styling */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
          <EmptyState
            icon={Boxes}
            title={products.length ? "No products match" : "No products yet"}
            desc="Add products to start managing stock and billing."
            action={
              <Button onClick={() => setEditing(blank())} className="mt-3 rounded-xl bg-blue-600 hover:bg-blue-700">
                <Plus className="size-4 mr-1.5" />
                Add your first product
              </Button>
            }
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  {th("name", "Product", "px-6 py-4")}
                  <th className="px-4 py-4 font-bold text-slate-400 uppercase tracking-wider text-[11px]">SKU</th>
                  {th("category", "Category", "px-4 py-4")}
                  {th("price", "Selling Price", "px-4 py-4")}
                  {th("stock", "Stock", "px-4 py-4")}
                  <th className="px-4 py-4 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-400 uppercase tracking-wider text-[11px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">
                      {p.sku}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {p.category}
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-4 py-4 text-slate-700 font-medium">
                      {p.stock}
                    </td>
                    <td className="px-4 py-4">
                      <StockBadge p={p} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setLabelFor(p)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                          title="Print Barcode Label"
                        >
                          <Tag className="size-3.5 inline mr-1" />
                          Label
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && <ProductModal product={editing} categories={cats} onClose={() => setEditing(null)} />}
      <LabelDialog product={labelFor} onClose={() => setLabelFor(null)} />
    </div>
  );
}

function LabelDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [n, setN] = useState(1);
  const [mode, setMode] = useState<"sticker" | "roll">("sticker");
  const settings = useDB((d) => d.settings);

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Tag className="size-4 text-blue-600" />
            2-Inch Label Printer
          </DialogTitle>
        </DialogHeader>

        {/* Format Selector: 2-inch Sticker vs 2-inch Roll */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode("sticker")}
            className={`py-1.5 px-2 rounded-lg transition-all text-center ${
              mode === "sticker"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            2" Sticker (50×30mm)
          </button>
          <button
            type="button"
            onClick={() => setMode("roll")}
            className={`py-1.5 px-2 rounded-lg transition-all text-center ${
              mode === "roll"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            2" Thermal Roll (58mm)
          </button>
        </div>

        {product && (
          <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between w-full mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {mode === "sticker" ? "Sticker Preview" : "Roll Receipt Preview"}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {mode === "sticker" ? "50 × 30 mm" : "48mm / 2-inch"}
              </span>
            </div>

            {/* Live 2-inch preview frame */}
            {mode === "sticker" ? (
              <div className="single-label-sticker border border-slate-300 dark:border-slate-700 rounded shadow-md">
                <div className="label-store">{settings.shopName || "NEXUS SPORTS"}</div>
                <div className="label-name">{product.name}</div>
                <div className="label-barcode-wrap">
                  <Barcode value={product.barcode} height={18} fontSize={8} margin={0} />
                </div>
                <div className="label-price-row">
                  <span className="label-mrp-label">MRP:</span>
                  <span className="label-price-val">{formatCurrency(product.price)}</span>
                  <span className="label-tax-note">(Incl. Tax)</span>
                </div>
              </div>
            ) : (
              <div className="w-[48mm] bg-white text-black p-2 rounded border border-slate-300 shadow-md font-mono text-center space-y-1">
                <div className="text-[9px] font-black uppercase truncate">{settings.shopName || "NEXUS SPORTS"}</div>
                <div className="text-[9px] font-bold leading-tight">{product.name}</div>
                <div className="flex justify-center py-0.5">
                  <Barcode value={product.barcode} height={22} fontSize={8} margin={0} />
                </div>
                <div className="text-[11px] font-black">{formatCurrency(product.price)}</div>
                <div className="text-[7px] text-black/60">(Inclusive of all taxes)</div>
              </div>
            )}

            <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
              Calibrated strictly for 2-inch thermal printers (zero blank margins).
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="label-count">
            Number of Label Copies
          </label>
          <input
            id="label-count"
            type="number"
            min={1}
            max={100}
            value={n}
            onChange={(e) => setN(Math.max(1, Number(e.target.value)))}
            className={field}
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 gap-2"
            onClick={() => product && printLabels(product, n, settings.shopName, mode)}
          >
            <Printer className="size-4" />
            Print on 2-inch Printer ({n} {n === 1 ? "Label" : "Labels"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductModal({ product, categories, onClose }: { product: Product; categories: string[]; onClose: () => void }) {
  const all = useDB((d) => d.products);
  const settings = useDB((d) => d.settings);
  const [f, setF] = useState(product);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [isCustomCat, setIsCustomCat] = useState(Boolean(product.category && !categories.includes(product.category)));
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e["name"] = "Product name is required";
    if (!f.sku.trim()) e["sku"] = "SKU is required";
    else if (all.some((p) => p.sku === f.sku && p.id !== f.id)) e["sku"] = "SKU already used";
    if (!f.category.trim()) e["category"] = "Category is required";
    if (f.price <= 0) e["price"] = "Price must be more than 0";
    if (f.cost < 0) e["cost"] = "Cost cannot be negative";
    if (f.barcode && all.some((p) => p.barcode === f.barcode && p.id !== f.id)) e["barcode"] = "Barcode already used by another product";
    setErrors(e);
    if (Object.keys(e).length) return;
    const next = { ...f, id: f.id || uid(), barcode: f.barcode || genBarcode() };
    update((d) => ({ ...d, products: f.id ? d.products.map((p) => (p.id === f.id ? next : p)) : [...d.products, next] }));
    toast.success(f.id ? "Product updated" : "Product added");
    onClose();
  };

  const F = ({ id, label, k, type = "text", list }: { id: string; label: string; k: keyof Product; type?: string; list?: string }) => (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} type={type} list={list} value={String(f[k])} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? id + "-err" : undefined}
        onChange={(e) => set(k, (type === "number" ? Number(e.target.value) : e.target.value) as never)}
        className={field + " mt-1 aria-[invalid=true]:border-destructive"} />
      {errors[k] && <p id={id + "-err"} className="mt-1 text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <form id="form-product" className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Basic info</legend>
            <div className="sm:col-span-2">{F({ id: "prod-name", label: "Name", k: "name" })}</div>
            {F({ id: "prod-sku", label: "SKU", k: "sku" })}
            <div>
              <label htmlFor="prod-category" className="text-sm font-medium">Category</label>
              <div className="relative mt-1">
                <select
                  id="prod-category"
                  value={isCustomCat ? "__custom__" : f.category}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomCat(true);
                      set("category", "");
                    } else {
                      setIsCustomCat(false);
                      set("category", e.target.value);
                    }
                  }}
                  className={field + " appearance-none pr-8"}
                >
                  <option value="" disabled>Select sports category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">+ Add Custom Category…</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
              </div>
              {isCustomCat && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Enter custom category name…"
                    value={f.category}
                    onChange={(e) => set("category", e.target.value)}
                    className={field}
                    autoFocus
                  />
                </div>
              )}
              {errors["category"] && <p id="prod-category-err" className="mt-1 text-xs text-destructive">{errors["category"]}</p>}
            </div>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Pricing & tax</legend>
            {F({ id: "prod-price", label: "Selling price (₹)", k: "price", type: "number" })}
            {F({ id: "prod-cost", label: "Cost price (₹)", k: "cost", type: "number" })}
            {F({ id: "prod-tax", label: "GST %", k: "tax", type: "number" })}
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Stock</legend>
            {F({ id: "prod-stock", label: "Quantity in stock", k: "stock", type: "number" })}
            {F({ id: "prod-low", label: "Low-stock alert at", k: "lowStock", type: "number" })}
          </fieldset>
          <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Barcode</legend>
            <div className="flex gap-2">
              <div className="flex-1">{F({ id: "prod-barcode", label: "Barcode (Code 128)", k: "barcode" })}</div>
              <Button type="button" variant="outline" className="mt-6 h-11" onClick={() => set("barcode", genBarcode())}>Generate</Button>
            </div>
            <div className="mt-3 grid place-items-center rounded-lg border bg-background p-3"><Barcode value={f.barcode} /></div>
            <div className="mt-3 flex items-end gap-2">
              <div><label htmlFor="prod-label-count" className="text-sm">Labels</label><input id="prod-label-count" type="number" min={1} value={labels} onChange={(e) => setLabels(Number(e.target.value))} className={field + " mt-1 w-24"} /></div>
              <Button type="button" variant="outline" className="h-11" disabled={!f.barcode} onClick={() => printLabels(f, labels, settings.shopName)}><Printer className="size-4 mr-2" />Print label</Button>
            </div>
          </fieldset>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {f.id ? <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>{f.active ? "Deactivate" : "Reactivate"}</Button> : <span />}
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="form-product">Save product</Button></div>
        </DialogFooter>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{f.active ? "Deactivate" : "Reactivate"} {f.name}?</AlertDialogTitle>
              <AlertDialogDescription>{f.active ? "It will be hidden from billing. Past sales are kept." : "It will appear in billing again."}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { update((d) => ({ ...d, products: d.products.map((p) => (p.id === f.id ? { ...p, active: !p.active } : p)) })); toast.success("Updated"); onClose(); }}>Confirm</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
