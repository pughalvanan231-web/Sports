import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Info,
  Moon,
  Printer,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, Panel, Pill, Receipt, printContent } from "@/components/pos/kit";
import {
  clearAllData,
  exportBackupJSON,
  getDB,
  importBackupJSON,
  resetData,
  update,
  useDB,
  type Sale,
  type Settings,
} from "@/lib/store";
import { exportCustomersToExcel, exportMasterPurchasesToExcel } from "@/lib/export";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexus Sports POS" },
      { name: "description", content: "Configure sports shop details, thermal receipt printing, tax rates, and local data backups." },
      { property: "og:title", content: "Settings — Nexus Sports POS" },
      { property: "og:description", content: "Configure sports shop details, thermal receipt printing, tax rates, and local data backups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const fieldClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm focus:border-primary focus:outline-none";

function SettingsPage() {
  const settings = useDB((d) => d.settings);
  const productsCount = useDB((d) => d.products.length);
  const customers = useDB((d) => d.customers);
  const customersCount = customers.length;
  const sales = useDB((d) => d.sales);
  const salesCount = sales.length;

  const [form, setForm] = useState<Settings>({ ...settings });
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"58mm" | "80mm" | "A4">(settings.paperSize || "58mm");

  const sampleSale: Sale = {
    id: "sample-preview",
    invoiceNo: `${form.invoicePrefix || "NX-"}1024`,
    date: new Date().toISOString(),
    customerName: "Priya Nair",
    customerPhone: "9123456780",
    items: [
      { productId: "p6", name: "Yonex Astrox Badminton Racket", price: 3499, qty: 1, tax: form.defaultTax, cost: 2400 },
      { productId: "p7", name: "Mavis 350 Shuttlecock (Tube of 6)", price: 899, qty: 2, tax: form.defaultTax, cost: 550 },
    ],
    subtotal: 5297,
    discount: 200,
    tax: 777.51,
    total: 5097,
    payment: "UPI",
    status: "completed",
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shopName.trim()) {
      toast.error("Shop name is required");
      return;
    }
    update((d) => ({
      ...d,
      settings: { ...form },
    }));
    document.documentElement.dataset["theme"] = form.theme;
    toast.success("Settings saved successfully!");
  };

  const handleExportBackup = () => {
    const json = exportBackupJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexus_sports_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Database backup downloaded!");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importBackupJSON(content);
      if (res.ok) {
        toast.success(res.message);
        setForm({ ...getDB().settings });
      } else {
        toast.error(`Import failed: ${res.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyTemplate = () => {
    const template = `Shop Name: ${form.shopName}
Address: ${form.address}
Phone: ${form.phone}
Email: ${form.email || "your-email@example.com"}
GSTIN: ${form.gstin}
Invoice Prefix: ${form.invoicePrefix}
Invoice Footer: ${form.invoiceFooter}
Paper Size: ${form.paperSize}
Default Tax Rate: ${form.defaultTax}%`;

    navigator.clipboard.writeText(template);
    setCopiedTemplate(true);
    toast.success("Shop details template copied to clipboard!");
    setTimeout(() => setCopiedTemplate(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Settings"
        desc="Configure your sports shop identity, receipt printers, tax rules, and local storage backups."
      />

      {/* Real Shop Details Callout */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/30 to-background p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">Want to use your real sports shop details?</h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              The shop name, address, products, customers and past sales are currently populated with sample data so your screens aren't empty.
              You can edit them directly in the form below, or click <b>Copy Shop Details</b> to send your real details over and have them swapped in.
            </p>
          </div>

          <Button
            onClick={handleCopyTemplate}
            variant="outline"
            className="shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10"
          >
            {copiedTemplate ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copiedTemplate ? "Copied to clipboard" : "Copy details template"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Shop Profile Section */}
        <Panel className="p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Building2 className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Shop Profile & Contact</h3>
              <p className="text-xs text-muted-foreground">Printed on top of every customer invoice and receipt</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-name">
                Sports Shop Name *
              </label>
              <input
                id="s-name"
                required
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                placeholder="e.g. Champion Sports Hub"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-phone">
                Phone Number *
              </label>
              <input
                id="s-phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 080-4000-1234 / 9876543210"
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-addr">
                Store Address (Printed on bill) *
              </label>
              <input
                id="s-addr"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 12 MG Road, Bengaluru, Karnataka 560001"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-gstin">
                GSTIN / Tax Registration Number
              </label>
              <input
                id="s-gstin"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 29ABCDE1234F1Z5"
                className={fieldClass + " font-mono uppercase"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-email">
                Email / Website
              </label>
              <input
                id="s-email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. info@championsports.in"
                className={fieldClass}
              />
            </div>
          </div>
        </Panel>

        {/* Invoicing & Receipts Configuration */}
        <Panel className="p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Printer className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Invoicing & Receipt Printing</h3>
              <p className="text-xs text-muted-foreground">Receipt sizing, invoice numbering, and tax calculation</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-prefix">
                Invoice Number Prefix
              </label>
              <input
                id="s-prefix"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                placeholder="e.g. NX- or SPORT-"
                className={fieldClass + " font-mono"}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Invoices will format as {form.invoicePrefix}1001, {form.invoicePrefix}1002…</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-paper">
                Receipt Printer Paper Size
              </label>
              <select
                id="s-paper"
                value={form.paperSize}
                onChange={(e) => {
                  const sz = e.target.value as "58mm" | "80mm" | "A4";
                  setForm({ ...form, paperSize: sz });
                  setPreviewFormat(sz);
                }}
                className={fieldClass}
              >
                <option value="58mm">2-inch (58mm) Thermal POS (Standard Mini Receipt)</option>
                <option value="80mm">3-inch (80mm) Thermal POS (Standard Roll)</option>
                <option value="A4">A4 Full Sheet Tax Invoice (Desktop Printer)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-tax">
                Default GST Tax Rate (%)
              </label>
              <input
                id="s-tax"
                type="number"
                min={0}
                max={50}
                value={form.defaultTax}
                onChange={(e) => setForm({ ...form, defaultTax: Number(e.target.value) || 0 })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-tax-mode">
                Pricing Tax Mode
              </label>
              <select
                id="s-tax-mode"
                value={form.taxInclusive ? "inclusive" : "exclusive"}
                onChange={(e) => setForm({ ...form, taxInclusive: e.target.value === "inclusive" })}
                className={fieldClass}
              >
                <option value="inclusive">Tax-Inclusive (Prices already include GST)</option>
                <option value="exclusive">Tax-Exclusive (GST added on top at checkout)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="s-footer">
                Receipt Footer Message
              </label>
              <input
                id="s-footer"
                value={form.invoiceFooter}
                onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
                placeholder="e.g. Thank you for shopping with us! Play hard, stay fit."
                className={fieldClass}
              />
            </div>
          </div>
        </Panel>

        {/* Live Bill Template Preview & Test Print */}
        <Panel className="p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <div>
                <h3 className="text-base font-bold text-foreground">Live Bill & Invoice Preview</h3>
                <p className="text-xs text-muted-foreground">Preview how your bill appears on paper with your current shop details</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-muted p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewFormat("58mm")}
                  className={`rounded-lg px-2.5 py-1.5 transition-all ${
                    previewFormat === "58mm" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  2-inch (58mm) POS
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat("80mm")}
                  className={`rounded-lg px-2.5 py-1.5 transition-all ${
                    previewFormat === "80mm" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  3-inch (80mm) POS
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFormat("A4")}
                  className={`rounded-lg px-2.5 py-1.5 transition-all ${
                    previewFormat === "A4" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  A4 Tax Invoice
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => printContent(<Receipt sale={sampleSale} settings={form} size={previewFormat} />, previewFormat)}
                className="gap-2 text-xs font-semibold h-9"
              >
                <Printer className="size-3.5" />
                Test Print ({previewFormat})
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 max-h-[500px] overflow-y-auto flex justify-center">
            <Receipt sale={sampleSale} settings={form} size={previewFormat} />
          </div>
        </Panel>

        {/* Appearance & Theme */}
        <Panel className="p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            {form.theme === "dark" ? <Moon className="size-5 text-primary" /> : <Sun className="size-5 text-primary" />}
            <div>
              <h3 className="text-base font-bold text-foreground">Color Theme & Appearance</h3>
              <p className="text-xs text-muted-foreground">Adjust contrast for indoor counters or low-light billing desks</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, theme: "light" })}
              className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm font-semibold transition-all ${
                form.theme === "light"
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Sun className="size-4" /> Light Mode
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, theme: "dark" })}
              className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm font-semibold transition-all ${
                form.theme === "dark"
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Moon className="size-4" /> Dark Mode
            </button>
          </div>
        </Panel>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" className="h-12 px-6 font-bold shadow-md gap-2">
            <Save className="size-4" /> Save Settings
          </Button>
        </div>
      </form>

      {/* Automatic Persistence & Storage Status */}
      <Panel className="p-4 md:p-6 space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold shadow-xs">
              <Check className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Automatic Data Persistence</h3>
              <p className="text-xs text-muted-foreground">
                All bills, products, customers, and settings are saved automatically in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportBackup}
              className="gap-2 text-xs font-semibold h-9"
            >
              <Download className="size-3.5 text-emerald-600" />
              Download Backup (JSON)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Products</p>
            <p className="text-lg font-black text-foreground mt-0.5">{productsCount}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Registered Customers</p>
            <p className="text-lg font-black text-foreground mt-0.5">{customersCount}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sales Invoices</p>
            <p className="text-lg font-black text-foreground mt-0.5">{salesCount}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Storage Status</p>
            <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center justify-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500"></span>
              Auto-Saving Active
            </p>
          </div>
        </div>
      </Panel>

      {/* Local Storage & Data Management Section */}
      <Panel className="p-4 md:p-6 space-y-5 border-dashed">
        <div className="flex items-center gap-2 pb-2 border-b">
          <HardDrive className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-bold text-foreground">Browser Local Storage & Backups</h3>
            <p className="text-xs text-muted-foreground">
              For offline resiliency, a synchronized snapshot is also kept in your browser storage.
            </p>
          </div>
        </div>

        {/* Database Status */}
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Products</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{productsCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Customers</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{customersCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Sales Bills</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{salesCount}</p>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <Info className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Local Persistence Advice</p>
            <p className="opacity-90 leading-relaxed">
              Because data is saved locally on this machine, clearing browser cache or cookies might erase your sales.
              We recommend clicking <b>Download Backup</b> at the end of every business day to save a copy.
            </p>
          </div>
        </div>

        {/* Backup & Restore Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExportBackup} variant="outline" className="gap-2">
            <Download className="size-4 text-emerald-600" />
            Download Backup (JSON)
          </Button>

          <Button
            onClick={() => exportCustomersToExcel(customers, sales)}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="size-4 text-primary" />
            Export Customers (Excel)
          </Button>

          <Button
            onClick={() => exportMasterPurchasesToExcel(sales)}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Export Purchases (Excel)
          </Button>

          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
              <Upload className="size-4 text-primary" />
              Restore Backup (JSON)
            </span>
          </label>

          <Button
            onClick={() => setResetConfirm(true)}
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-4" />
            Reset to Sample Data
          </Button>

          <Button
            onClick={() => setClearConfirm(true)}
            variant="ghost"
            className="gap-2 text-destructive hover:bg-danger-soft hover:text-destructive ml-auto"
          >
            <Trash2 className="size-4" />
            Clear All Data
          </Button>
        </div>
      </Panel>

      {/* Reset to Sample Confirmation */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to sample sports data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current data with the default sample sports products, customers, and sales.
              Any custom sales you recorded will be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetData();
                setForm({ ...getDB().settings });
                toast.success("Reset to sample sports data!");
                setResetConfirm(false);
              }}
            >
              Reset to sample
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all store data?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all products, customers, and sales?
              This will give you a completely blank slate with zero records so you can start entering your real inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllData();
                toast.success("All products, customers, and sales cleared!");
                setClearConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
