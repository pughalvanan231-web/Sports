import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  HardDrive,
  IndianRupee,
  LayoutDashboard,
  PackageX,
  Plus,
  Receipt,
  ScanBarcode,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState, InvoiceModal, PageHeader, Panel, Pill, StatCard, StockBadge, printContent } from "@/components/pos/kit";
import { formatCurrency, stockStatus, useDB, type Sale } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus Sports POS" },
      { name: "description", content: "Executive overview of sales, stock alerts, and customer activity for your sports shop." },
      { property: "og:title", content: "Dashboard — Nexus Sports POS" },
      { property: "og:description", content: "Executive overview of sales, stock alerts, and customer activity for your sports shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const products = useDB((d) => d.products);
  const sales = useDB((d) => d.sales);
  const customers = useDB((d) => d.customers);
  const settings = useDB((d) => d.settings);

  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);
  const activeSales = useMemo(() => sales.filter((s) => s.status !== "refunded"), [sales]);

  // Today metrics
  const todaySales = useMemo(() => {
    const now = new Date();
    return activeSales.filter((s) => {
      const d = new Date(s.date);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [activeSales]);

  const todayRevenue = useMemo(() => todaySales.reduce((acc, s) => acc + s.total, 0), [todaySales]);
  const todayUnits = useMemo(() => todaySales.reduce((acc, s) => acc + s.items.reduce((q, i) => q + i.qty, 0), 0), [todaySales]);

  // Stock inventory metrics
  const lowStockProducts = useMemo(() => activeProducts.filter((p) => stockStatus(p) === "low"), [activeProducts]);
  const outOfStockProducts = useMemo(() => activeProducts.filter((p) => stockStatus(p) === "out"), [activeProducts]);
  const totalStockValueCost = useMemo(() => activeProducts.reduce((acc, p) => acc + (p.cost || 0) * Math.max(p.stock, 0), 0), [activeProducts]);

  // Past 7 days sales trend data
  const last7DaysData = useMemo(() => {
    const days: { date: string; fullDate: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      const full = d.toISOString().slice(0, 10);
      days.push({ date: label, fullDate: full, revenue: 0, orders: 0 });
    }

    activeSales.forEach((s) => {
      const sDate = s.date.slice(0, 10);
      const match = days.find((d) => d.fullDate === sDate);
      if (match) {
        match.revenue += s.total;
        match.orders += 1;
      }
    });

    return days;
  }, [activeSales]);

  // Recent 6 invoices
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [sales]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-accent/30 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sports Counter
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="size-3" /> Stored locally in this browser
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
              {settings.shopName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings.address} · GSTIN: <span className="font-mono">{settings.gstin}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="h-11 shadow-sm font-semibold">
              <Link to="/">
                <ScanBarcode className="size-4" />
                New Bill <span className="kbd ml-1">Ctrl B</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-11">
              <Link to="/inventory">
                <Boxes className="size-4" />
                Add Product
              </Link>
            </Button>
            <Button variant="ghost" asChild className="h-11">
              <Link to="/settings">
                <Settings className="size-4" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(todayRevenue)}
          icon={TrendingUp}
          tone="primary"
          hint={`${todaySales.length} bills · ${todayUnits} gear items`}
        />
        <StatCard
          label="Total Inventory Value"
          value={formatCurrency(totalStockValueCost)}
          icon={IndianRupee}
          tone="success"
          hint="Calculated at wholesale cost"
        />
        <StatCard
          label="Stock Warnings"
          value={lowStockProducts.length + outOfStockProducts.length}
          icon={AlertTriangle}
          tone={outOfStockProducts.length > 0 ? "danger" : "warning"}
          hint={`${outOfStockProducts.length} out of stock, ${lowStockProducts.length} low`}
        />
        <StatCard
          label="Total Customers"
          value={customers.length}
          icon={Users}
          tone="info"
          hint="Loyalty player database"
        />
      </div>

      {/* Main Grid: 7-Day Chart & Stock Watchlist */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Chart (2 cols) */}
        <Panel className="p-4 md:p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">7-Day Sales Performance</h2>
              <p className="text-xs text-muted-foreground">Daily billings across the counter</p>
            </div>
            <Button variant="outline" size="sm" asChild className="h-8 gap-1 text-xs">
              <Link to="/reports">
                Detailed Reports <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>

          <div className="h-64 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7DaysData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                  />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(Number(v) || 0), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Loading 7-day chart…
              </div>
            )}
          </div>
        </Panel>

        {/* Urgent Stock Watchlist (1 col) */}
        <Panel className="p-4 md:p-6 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Stock Watchlist</h2>
              <p className="text-xs text-muted-foreground">Reorder gear before it sells out</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
              <Link to="/inventory">All Inventory</Link>
            </Button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
            {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" />
                All sports inventory is fully stocked!
              </div>
            ) : (
              <>
                {outOfStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-danger-soft/60 bg-danger-soft/20 p-2.5 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-muted-foreground">{p.category} {p.barcode ? `· ${p.barcode}` : ""}</p>
                    </div>
                    <Pill tone="danger">Out of stock</Pill>
                  </div>
                ))}
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-warning-soft/60 bg-warning-soft/20 p-2.5 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-muted-foreground">{p.category} {p.barcode ? `· ${p.barcode}` : ""}</p>
                    </div>
                    <Pill tone="warning">{p.stock} left</Pill>
                  </div>
                ))}
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Recent Invoices Table */}
      <Panel>
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Recent Invoices</h2>
            <p className="text-xs text-muted-foreground">Latest transactions completed at the billing counter</p>
          </div>
          <Button variant="outline" size="sm" asChild className="h-9 gap-1 text-xs">
            <Link to="/sales">
              View All Invoices <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {recentSales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            desc="Head to Billing to start processing sales."
            action={
              <Button asChild>
                <Link to="/">Go to Billing</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice #</th>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      {sale.invoiceNo}
                      {sale.status === "refunded" && (
                        <span className="ml-2"><Pill tone="danger">Refunded</Pill></span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(sale.date).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {sale.customerName || "Walk-in"}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={sale.payment === "UPI" ? "success" : sale.payment === "Credit" ? "warning" : "primary"}>
                        {sale.payment}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setViewSale(sale)}
                      >
                        <Receipt className="size-3.5" />
                        Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Sample Data & Browser Storage Callout Banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-bold text-sm text-foreground">Your Real Shop Details</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            The shop name, address, sports products, customers, and past sales currently shown are sample data so your screens aren't empty.
            Everything is saved locally in this browser. You can customize them directly in Settings or send your real shop details to swap them in!
          </p>
        </div>

        <Button asChild variant="outline" className="shrink-0 border-primary/30 text-primary hover:bg-primary/10">
          <Link to="/settings">
            Customize in Settings <ArrowRight className="size-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Professional Tax Invoice & Receipt Modal */}
      <InvoiceModal
        open={!!viewSale}
        onClose={() => setViewSale(null)}
        sale={viewSale}
        settings={settings}
      />
    </div>
  );
}
