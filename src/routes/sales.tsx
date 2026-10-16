import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  FileSpreadsheet,
  IndianRupee,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState, PageHeader, Panel, Pill, Receipt as ReceiptDoc, StatCard, printContent } from "@/components/pos/kit";
import { deleteSale, formatCurrency, refundSale, useDB, type PaymentMethod, type Sale } from "@/lib/store";
import { exportMasterPurchasesToExcel } from "@/lib/export";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales & Invoices — Nexus Sports POS" },
      { name: "description", content: "View sports store invoices, reprint receipts, and process returns." },
      { property: "og:title", content: "Sales & Invoices — Nexus Sports POS" },
      { property: "og:description", content: "View sports store invoices, reprint receipts, and process returns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

const fieldClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm focus:border-primary focus:outline-none";

const isToday = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isYesterday = (dateStr: string) => {
  const d = new Date(dateStr);
  const yesterday = new Date(Date.now() - 86400000);
  return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
};

const isWithinDays = (dateStr: string, days: number) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff >= 0 && diff <= days * 86400000;
};

const isThisMonth = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

function SalesPage() {
  const sales = useDB((d) => d.sales);
  const settings = useDB((d) => d.settings);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "refunded">("all");

  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [refundConfirm, setRefundConfirm] = useState<Sale | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Sale | null>(null);

  // Statistics
  const activeSales = useMemo(() => sales.filter((s) => s.status !== "refunded"), [sales]);

  const totalRevenue = useMemo(() => activeSales.reduce((acc, s) => acc + s.total, 0), [activeSales]);
  const todayRevenue = useMemo(() => activeSales.filter((s) => isToday(s.date)).reduce((acc, s) => acc + s.total, 0), [activeSales]);
  const todayCount = useMemo(() => activeSales.filter((s) => isToday(s.date)).length, [activeSales]);
  const avgOrderValue = useMemo(() => (activeSales.length ? totalRevenue / activeSales.length : 0), [activeSales, totalRevenue]);

  // Filtered sales sorted newest first
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales
      .filter((s) => {
        // Date filter
        if (dateFilter === "today" && !isToday(s.date)) return false;
        if (dateFilter === "yesterday" && !isYesterday(s.date)) return false;
        if (dateFilter === "week" && !isWithinDays(s.date, 7)) return false;
        if (dateFilter === "month" && !isThisMonth(s.date)) return false;

        // Payment filter
        if (paymentFilter !== "all" && s.payment !== paymentFilter) return false;

        // Status filter
        if (statusFilter === "completed" && s.status === "refunded") return false;
        if (statusFilter === "refunded" && s.status !== "refunded") return false;

        // Text query
        if (!q) return true;
        const matchesInvoice = s.invoiceNo.toLowerCase().includes(q);
        const matchesCustomer = s.customerName.toLowerCase().includes(q);
        const matchesPhone = s.customerPhone.includes(q);
        const matchesItems = s.items.some((i) => i.name.toLowerCase().includes(q));

        return matchesInvoice || matchesCustomer || matchesPhone || matchesItems;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, search, dateFilter, paymentFilter, statusFilter]);

  const handleRefund = () => {
    if (!refundConfirm) return;
    refundSale(refundConfirm.id);
    toast.success(`Invoice ${refundConfirm.invoiceNo} marked as refunded and items restored to stock!`);
    setRefundConfirm(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteSale(deleteConfirm.id, false);
    toast.success(`Invoice ${deleteConfirm.invoiceNo} deleted`);
    setDeleteConfirm(null);
  };

  const copyInvoice = (invoiceNo: string) => {
    navigator.clipboard.writeText(invoiceNo);
    toast.success(`Copied ${invoiceNo} to clipboard`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Invoices"
        desc="Audit past sports transactions, reprint thermal receipts, and process refunds."
      >
        <Button
          variant="outline"
          className="h-11 gap-1.5 shadow-sm"
          onClick={() => exportMasterPurchasesToExcel(filteredSales)}
          title="Download sales and itemized purchases as Excel spreadsheet"
        >
          <FileSpreadsheet className="size-4 text-emerald-600" />
          Export to Excel
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={IndianRupee}
          tone="success"
          hint={`${activeSales.length} total bills`}
        />
        <StatCard
          label="Today's Sales"
          value={formatCurrency(todayRevenue)}
          icon={TrendingUp}
          tone="primary"
          hint={`${todayCount} orders today`}
        />
        <StatCard
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          icon={Receipt}
          tone="info"
          hint="Per invoice average"
        />
        <StatCard
          label="Total Invoices"
          value={sales.length}
          icon={Package}
          tone="muted"
          hint={`${sales.filter((s) => s.status === "refunded").length} returned/refunded`}
        />
      </div>

      {/* Main Register Panel */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, customer, item name…"
              className={fieldClass + " pl-9"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "yesterday" | "week" | "month")}
              className={fieldClass + " w-auto"}
              aria-label="Filter by date"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as "all" | PaymentMethod)}
              className={fieldClass + " w-auto"}
              aria-label="Filter by payment"
            >
              <option value="all">All Payments</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Credit">Credit (Pay Later)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "refunded")}
              className={fieldClass + " w-auto"}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded / Returned</option>
            </select>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={sales.length ? "No transactions match your filters" : "No sales recorded yet"}
            desc={sales.length ? "Try clearing search or changing date filters." : "Complete a checkout on the Billing screen to see invoices here."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice #</th>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Items Purchased</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSales.map((sale) => {
                  const isRefunded = sale.status === "refunded";
                  const totalItemsQty = sale.items.reduce((acc, i) => acc + i.qty, 0);

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isRefunded ? "opacity-75 bg-muted/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyInvoice(sale.invoiceNo)}
                            className="font-mono font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                            title="Click to copy invoice number"
                          >
                            <span>{sale.invoiceNo}</span>
                            <Copy className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          {isRefunded && <Pill tone="danger">Refunded</Pill>}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          <span>
                            {new Date(sale.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-muted-foreground/60">
                            {new Date(sale.date).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {sale.customerName || "Walk-in"}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {sale.customerPhone}
                          </div>
                        )}
                      </td>

                      <td className="hidden px-4 py-3.5 md:table-cell max-w-xs">
                        <p className="line-clamp-1 text-xs text-foreground">
                          {sale.items.map((i) => `${i.name} (${i.qty})`).join(", ")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {totalItemsQty} {totalItemsQty === 1 ? "unit" : "units"}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <Pill
                          tone={
                            sale.payment === "UPI"
                              ? "success"
                              : sale.payment === "Credit"
                              ? "warning"
                              : sale.payment === "Card"
                              ? "info"
                              : "primary"
                          }
                        >
                          {sale.payment}
                        </Pill>
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-foreground">
                        <span className={isRefunded ? "line-through text-muted-foreground" : ""}>
                          {formatCurrency(sale.total)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setViewSale(sale)}
                            title="Preview and print receipt"
                          >
                            <Receipt className="size-3.5" />
                            <span className="hidden sm:inline">Receipt</span>
                          </Button>

                          {!isRefunded && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-amber-600 hover:bg-warning-soft hover:text-amber-700"
                              onClick={() => setRefundConfirm(sale)}
                              title="Process return / refund"
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-destructive hover:bg-danger-soft hover:text-destructive"
                            onClick={() => setDeleteConfirm(sale)}
                            title="Delete sale record"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Invoice Receipt Modal */}
      <Dialog open={!!viewSale} onOpenChange={(open) => !open && setViewSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {viewSale?.invoiceNo}</span>
              {viewSale?.status === "refunded" && <Pill tone="danger">Refunded</Pill>}
            </DialogTitle>
          </DialogHeader>

          {viewSale && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4">
                <ReceiptDoc sale={viewSale} settings={settings} />
              </div>

              <DialogFooter className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => printContent(<ReceiptDoc sale={viewSale} settings={settings} />)}
                  className="gap-2"
                >
                  <Printer className="size-4" />
                  Print receipt
                </Button>
                <Button onClick={() => setViewSale(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={!!refundConfirm} onOpenChange={(open) => !open && setRefundConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process refund / return?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund invoice <b>{refundConfirm?.invoiceNo}</b> (
              {refundConfirm && formatCurrency(refundConfirm.total)})?
              <br /><br />
              All items in this bill will be automatically returned to inventory stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Confirm refund & restock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete invoice <b>{deleteConfirm?.invoiceNo}</b>?
              This will remove the transaction from your sales history. (Inventory stock will not be affected).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
