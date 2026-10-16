import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  IndianRupee,
  Layers,
  Percent,
  Receipt,
  Tag,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/pos/kit";
import { formatCurrency, useDB, type Sale } from "@/lib/store";
import { downloadExcelCSV, exportCustomersToExcel, exportMasterPurchasesToExcel } from "@/lib/export";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Financials — Nexus Sports POS" },
      { name: "description", content: "Financial analytics, profit margins, GST reporting, and sales CSV exports." },
      { property: "og:title", content: "Reports & Financials — Nexus Sports POS" },
      { property: "og:description", content: "Financial analytics, profit margins, GST reporting, and sales CSV exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type DateRange = "7d" | "30d" | "month" | "all";

const COLORS = [
  "oklch(0.546 0.215 262.9)", // Primary Blue
  "oklch(0.52 0.14 155)",     // Green
  "oklch(0.68 0.19 45)",      // Orange / Energy
  "oklch(0.55 0.13 70)",      // Yellow / Amber
  "oklch(0.6 0.15 320)",      // Purple
  "oklch(0.5 0.15 240)",      // Cyan
];

function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const sales = useDB((d) => d.sales);
  const products = useDB((d) => d.products);
  const customers = useDB((d) => d.customers);
  const settings = useDB((d) => d.settings);

  const [range, setRange] = useState<DateRange>("30d");

  // Filter sales by date range and exclude refunded
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return sales
      .filter((s) => s.status !== "refunded")
      .filter((s) => {
        const time = new Date(s.date).getTime();
        const diffDays = (now - time) / 86400000;

        if (range === "7d") return diffDays <= 7;
        if (range === "30d") return diffDays <= 30;
        if (range === "month") {
          const d = new Date(s.date);
          const current = new Date();
          return d.getMonth() === current.getMonth() && d.getFullYear() === current.getFullYear();
        }
        return true; // "all"
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, range]);

  // Aggregate metrics
  const totalRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + s.total, 0), [filteredSales]);
  const totalTax = useMemo(() => filteredSales.reduce((acc, s) => acc + s.tax, 0), [filteredSales]);
  const totalDiscount = useMemo(() => filteredSales.reduce((acc, s) => acc + s.discount, 0), [filteredSales]);

  // Cost of goods sold (COGS)
  const totalCost = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const saleCost = s.items.reduce((c, i) => c + (i.cost || 0) * i.qty, 0);
      return acc + saleCost;
    }, 0);
  }, [filteredSales]);

  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.items.reduce((q, i) => q + i.qty, 0), 0);
  }, [filteredSales]);

  // Daily trend chart data
  const trendData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; profit: number; orders: number }>();

    filteredSales.forEach((s) => {
      const dayKey = new Date(s.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const saleCost = s.items.reduce((c, i) => c + (i.cost || 0) * i.qty, 0);
      const existing = map.get(dayKey) || { date: dayKey, revenue: 0, profit: 0, orders: 0 };
      existing.revenue += s.total;
      existing.profit += s.total - saleCost;
      existing.orders += 1;
      map.set(dayKey, existing);
    });

    return Array.from(map.values());
  }, [filteredSales]);

  // Payment method breakdown
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s) => {
      map.set(s.payment, (map.get(s.payment) || 0) + s.total);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; units: number; cost: number }>();

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || "Other";
        const existing = map.get(cat) || { category: cat, revenue: 0, units: 0, cost: 0 };
        existing.revenue += item.price * item.qty;
        existing.units += item.qty;
        existing.cost += (item.cost || 0) * item.qty;
        map.set(cat, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number }>();
    filteredSales.forEach((s) => {
      s.items.forEach((i) => {
        const existing = map.get(i.name) || { name: i.name, revenue: 0, units: 0 };
        existing.revenue += i.price * i.qty;
        existing.units += i.qty;
        map.set(i.name, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [filteredSales]);

  // CSV Export functions
  const exportSalesRegisterCSV = () => {
    const headers = ["Invoice No", "Date", "Customer Name", "Customer Phone", "Payment Method", "Items Count", "Subtotal (INR)", "Discount (INR)", "Tax (INR)", "Total (INR)", "Status"];
    const rows = filteredSales.map((s) => [
      s.invoiceNo,
      new Date(s.date).toISOString().slice(0, 19).replace("T", " "),
      s.customerName,
      s.customerPhone ? `="${s.customerPhone}"` : "",
      s.payment,
      s.items.reduce((acc, i) => acc + i.qty, 0),
      s.subtotal.toFixed(2),
      s.discount.toFixed(2),
      s.tax.toFixed(2),
      s.total.toFixed(2),
      s.status || "completed",
    ]);

    downloadExcelCSV(`sales_register_${range}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const exportGSTReportCSV = () => {
    const headers = ["Invoice No", "Date", "Shop GSTIN", "Customer Name", "Customer GSTIN", "Taxable Value (INR)", "GST Rate", "GST Amount (INR)", "Invoice Total (INR)"];
    const rows = filteredSales.map((s) => [
      s.invoiceNo,
      new Date(s.date).toLocaleDateString("en-IN"),
      settings.gstin,
      s.customerName,
      "",
      (s.total - s.tax).toFixed(2),
      `${settings.defaultTax}%`,
      s.tax.toFixed(2),
      s.total.toFixed(2),
    ]);

    downloadExcelCSV(`gst_tax_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const exportCategorySummaryCSV = () => {
    const headers = ["Sports Category", "Units Sold", "Total Revenue (INR)", "Estimated Cost (INR)", "Gross Profit (INR)", "Profit Margin %"];
    const rows = categoryData.map((c) => {
      const p = c.revenue - c.cost;
      const m = c.revenue > 0 ? ((p / c.revenue) * 100).toFixed(1) : "0";
      return [
        c.category,
        c.units,
        c.revenue.toFixed(2),
        c.cost.toFixed(2),
        p.toFixed(2),
        `${m}%`,
      ];
    });

    downloadExcelCSV(`category_sales_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        desc="Business health, profit analysis, tax records, and sports inventory turnover."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-card p-1 shadow-sm">
            {(
              [
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "month", label: "This Month" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setRange(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  range === t.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Button variant="outline" className="h-9 gap-1 text-xs" onClick={exportSalesRegisterCSV}>
            <ArrowDownToLine className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Gross Revenue"
          value={formatCurrency(totalRevenue)}
          icon={IndianRupee}
          tone="primary"
          hint={`${filteredSales.length} orders in range`}
        />
        <StatCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          icon={TrendingUp}
          tone="success"
          hint={`${marginPercent}% gross margin`}
        />
        <StatCard
          label="GST Tax Collected"
          value={formatCurrency(totalTax)}
          icon={Receipt}
          tone="info"
          hint={`Applicable GST (incl.)`}
        />
        <StatCard
          label="Units of Gear Sold"
          value={totalUnitsSold}
          icon={Layers}
          tone="warning"
          hint={`${categoryData.length} active categories`}
        />
      </div>

      {/* Charts Row */}
      {filteredSales.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="No sales in selected period"
            desc="Change the date range filter or complete sales to see reports."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {/* Revenue & Profit Area Chart */}
          <Panel className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground">Revenue & Profit Trend</h3>
                <p className="text-xs text-muted-foreground">Daily sales performance and estimated net profit</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-medium">
                  <span className="inline-block size-3 rounded-full bg-primary" />
                  Revenue
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <span className="inline-block size-3 rounded-full bg-emerald-500" />
                  Profit
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value) || 0)]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProf)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Loading trend chart…
                </div>
              )}
            </div>
          </Panel>

          {/* Secondary Charts: Category Breakdown & Payment Share */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales by Category */}
            <Panel className="p-4 md:p-6 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-foreground">Sales by Sports Category</h3>
                <p className="text-xs text-muted-foreground">Revenue distribution across sport types</p>
              </div>

              <div className="h-64 w-full flex-1">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                      />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val) || 0), "Revenue"]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]}>
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Loading category chart…
                  </div>
                )}
              </div>
            </Panel>

            {/* Payment Method Share */}
            <Panel className="p-4 md:p-6 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-foreground">Payment Methods Share</h3>
                <p className="text-xs text-muted-foreground">Revenue collected via UPI, Cash, Cards, and Credit</p>
              </div>

              <div className="h-64 w-full flex-1">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val) || 0), "Total"]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => <span className="text-xs text-foreground font-medium">{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Loading payments breakdown…
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Top Products & Category Table */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products Table */}
            <Panel className="p-4 md:p-6">
              <h3 className="text-base font-bold text-foreground mb-1">Bestselling Sports Equipment</h3>
              <p className="text-xs text-muted-foreground mb-4">Ranked by revenue generation</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Product</th>
                      <th className="px-3 py-2 font-semibold text-center">Units</th>
                      <th className="px-3 py-2 font-semibold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topProducts.map((p, idx) => (
                      <tr key={p.name} className="hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                          <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="line-clamp-1">{p.name}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-muted-foreground">
                          {p.units}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">
                          {formatCurrency(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Export & Download Hub */}
            <Panel className="p-4 md:p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground mb-1">Export Data & GST Reports</h3>
                <p className="text-xs text-muted-foreground mb-4">Download spreadsheet-ready CSV files for your accountant</p>

                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="font-semibold text-sm">Customer Purchases Master</p>
                      <p className="text-xs text-muted-foreground">Every item purchased linked to customer names & phones</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportMasterPurchasesToExcel(filteredSales)}>
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      Purchases Excel
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="font-semibold text-sm">Customer Directory</p>
                      <p className="text-xs text-muted-foreground">Names, phones, addresses, lifetime spend, and store credit</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCustomersToExcel(customers, sales)}>
                      <FileSpreadsheet className="size-4 text-primary" />
                      Customers Excel
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="font-semibold text-sm">Full Sales Register</p>
                      <p className="text-xs text-muted-foreground">Every invoice, customer contact, and payment tag</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={exportSalesRegisterCSV}>
                      <FileSpreadsheet className="size-4 text-emerald-600" />
                      Sales Excel
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="font-semibold text-sm">GST Tax Return File</p>
                      <p className="text-xs text-muted-foreground">Taxable value, GST rate, and GSTIN breakdown</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={exportGSTReportCSV}>
                      <Receipt className="size-4 text-primary" />
                      GST Excel
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="font-semibold text-sm">Category Performance</p>
                      <p className="text-xs text-muted-foreground">Units sold, revenue, and gross profit margins</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCategorySummaryCSV}>
                      <Tag className="size-4 text-amber-600" />
                      Category Excel
                    </Button>
                  </div>
              </div>

              <div className="mt-4 rounded-lg bg-accent/40 p-3 text-xs text-accent-foreground">
                <p className="font-semibold">Local Storage Note</p>
                <p className="mt-0.5 opacity-80">
                  Reports compute dynamically from sales recorded on this device. Back up your data periodically in Settings.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
