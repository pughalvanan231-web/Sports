import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CreditCard,
  FileSpreadsheet,
  History,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
  Users,
  Wallet,
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
import { EmptyState, InvoiceModal, PageHeader, Panel, Pill, StatCard, printContent } from "@/components/pos/kit";
import { formatCurrency, uid, update, useDB, type Customer, type Sale } from "@/lib/store";
import { exportCustomersToExcel, exportCustomerPurchasesToExcel } from "@/lib/export";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Nexus Sports POS" },
      { name: "description", content: "Manage sports shop customers, credit history, and purchase loyalty." },
      { property: "og:title", content: "Customers — Nexus Sports POS" },
      { property: "og:description", content: "Manage sports shop customers, credit history, and purchase loyalty." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

type SortKey = "name" | "spend" | "orders" | "recent";
const fieldClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm focus:border-primary focus:outline-none";

function CustomersPage() {
  const navigate = useNavigate();
  const customers = useDB((d) => d.customers);
  const sales = useDB((d) => d.sales);
  const settings = useDB((d) => d.settings);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "credit" | "repeat">("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const [modalCustomer, setModalCustomer] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  // Precompute customer metrics
  const customerStats = useMemo(() => {
    const map = new Map<string, { totalSpend: number; ordersCount: number; lastDate: string | null; creditDue: number }>();

    for (const c of customers) {
      map.set(c.phone || c.id, { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 });
    }

    for (const s of sales) {
      if (!s.customerPhone && s.customerName === "Walk-in") continue;
      const key = s.customerPhone || s.customerName;
      let stat = map.get(key);
      if (!stat) {
        stat = { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
        map.set(key, stat);
      }
      if (s.status !== "refunded") {
        stat.totalSpend += s.total;
        stat.ordersCount += 1;
        if (s.payment === "Credit") {
          stat.creditDue += s.total;
        }
        if (!stat.lastDate || new Date(s.date) > new Date(stat.lastDate)) {
          stat.lastDate = s.date;
        }
      }
    }
    return map;
  }, [customers, sales]);

  const totalCreditDue = useMemo(() => {
    let due = 0;
    customerStats.forEach((v) => {
      due += v.creditDue;
    });
    return due;
  }, [customerStats]);

  const totalSpendAll = useMemo(() => {
    let sum = 0;
    customerStats.forEach((v) => {
      sum += v.totalSpend;
    });
    return sum;
  }, [customerStats]);

  const repeatCustomersCount = useMemo(() => {
    let count = 0;
    customerStats.forEach((v) => {
      if (v.ordersCount > 1) count++;
    });
    return count;
  }, [customerStats]);

  // Filtered & sorted customers
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => {
        const stat = customerStats.get(c.phone) || { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
        if (filter === "credit" && stat.creditDue <= 0) return false;
        if (filter === "repeat" && stat.ordersCount < 2) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const statA = customerStats.get(a.phone) || { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
        const statB = customerStats.get(b.phone) || { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };

        if (sortBy === "name") {
          return a.name.localeCompare(b.name) * sortDir;
        }
        if (sortBy === "spend") {
          return (statA.totalSpend - statB.totalSpend) * sortDir;
        }
        if (sortBy === "orders") {
          return (statA.ordersCount - statB.ordersCount) * sortDir;
        }
        // recent
        const dateA = statA.lastDate ? new Date(statA.lastDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = statB.lastDate ? new Date(statB.lastDate).getTime() : new Date(b.createdAt).getTime();
        return (dateA - dateB) * sortDir;
      });
  }, [customers, search, filter, sortBy, sortDir, customerStats]);

  const handleOpenAdd = () => {
    setIsNew(true);
    setModalCustomer({
      id: "",
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      createdAt: new Date().toISOString(),
    });
  };

  const handleBillCustomer = (c: Customer) => {
    navigate({
      to: "/",
      search: { cust: c.name, phone: c.phone } as never,
    });
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCustomer) return;
    if (!modalCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!modalCustomer.phone.trim() || modalCustomer.phone.length < 7) {
      toast.error("Valid phone number is required");
      return;
    }

    if (isNew) {
      const exists = customers.some((c) => c.phone === modalCustomer.phone);
      if (exists) {
        toast.error("A customer with this phone number already exists");
        return;
      }
      const newCust: Customer = {
        ...modalCustomer,
        id: uid(),
        createdAt: new Date().toISOString(),
      };
      update((d) => ({ ...d, customers: [newCust, ...d.customers] }));
      toast.success(`Customer "${newCust.name}" added successfully`);
    } else {
      update((d) => ({
        ...d,
        customers: d.customers.map((c) => (c.id === modalCustomer.id ? modalCustomer : c)),
      }));
      toast.success(`Customer "${modalCustomer.name}" updated`);
    }
    setModalCustomer(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteCustomer) return;
    update((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== deleteCustomer.id),
    }));
    toast.success(`Removed customer ${deleteCustomer.name}`);
    setDeleteCustomer(null);
  };

  const getCustomerSales = (c: Customer) => {
    return sales
      .filter((s) => s.customerPhone === c.phone || (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        desc="Build loyalty, track player gear history, and monitor store credit."
      >
        <Button
          variant="outline"
          className="h-11 gap-1.5 shadow-sm"
          onClick={() => exportCustomersToExcel(customers, sales)}
          title="Download customers list as Excel spreadsheet"
        >
          <FileSpreadsheet className="size-4 text-emerald-600" />
          Export to Excel
        </Button>
        <Button className="h-11 shadow-sm" onClick={handleOpenAdd}>
          <Plus className="size-4" />
          Add customer
        </Button>
      </PageHeader>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          value={customers.length}
          icon={Users}
          hint="Registered in local database"
        />
        <StatCard
          label="Customer spend"
          value={formatCurrency(totalSpendAll)}
          icon={Wallet}
          tone="success"
          hint="Lifetime registered value"
        />
        <StatCard
          label="Repeat buyers"
          value={repeatCustomersCount}
          icon={UserCheck}
          tone="info"
          hint={`${customers.length ? Math.round((repeatCustomersCount / customers.length) * 100) : 0}% loyalty rate`}
        />
        <StatCard
          label="Store credit balance"
          value={formatCurrency(totalCreditDue)}
          icon={CreditCard}
          tone={totalCreditDue > 0 ? "warning" : "primary"}
          hint={totalCreditDue > 0 ? "Outstanding credit sales" : "All cleared"}
        />
      </div>

      {/* Controls & Table */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, notes…"
              className={fieldClass + " pl-9"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "credit" | "repeat")}
              className={fieldClass + " w-auto"}
              aria-label="Filter customers"
            >
              <option value="all">All customers</option>
              <option value="repeat">Repeat buyers (2+ orders)</option>
              <option value="credit">With store credit due</option>
            </select>

            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [k, dir] = e.target.value.split(":") as [SortKey, string];
                setSortBy(k);
                setSortDir(Number(dir) as 1 | -1);
              }}
              className={fieldClass + " w-auto"}
              aria-label="Sort customers"
            >
              <option value="recent:-1">Recently visited</option>
              <option value="spend:-1">Highest spend</option>
              <option value="orders:-1">Most orders</option>
              <option value="name:1">Name (A → Z)</option>
            </select>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={customers.length ? "No customers match your search" : "No customers yet"}
            desc={customers.length ? "Try clearing search filters." : "Add your first sports customer or create an invoice at billing."}
            action={
              <Button onClick={handleOpenAdd}>
                <Plus className="size-4" />
                Add customer
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold text-center">Orders</th>
                  <th className="px-4 py-3 font-semibold text-right">Total spent</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Last visit</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.map((c) => {
                  const stat = customerStats.get(c.phone) || { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
                  const initials = c.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {initials || "C"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{c.name}</span>
                              {stat.creditDue > 0 && (
                                <Pill tone="warning">Credit: {formatCurrency(stat.creditDue)}</Pill>
                              )}
                            </div>
                            {c.notes && (
                              <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                                {c.notes}
                              </p>
                            )}
                            {c.address && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="size-3" /> {c.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1 font-mono text-xs">
                            <Phone className="size-3 text-muted-foreground" />
                            {c.phone}
                          </p>
                          {c.email && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="size-3" />
                              {c.email}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                          {stat.ordersCount} {stat.ordersCount === 1 ? "bill" : "bills"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-foreground">
                        {formatCurrency(stat.totalSpend)}
                      </td>

                      <td className="hidden px-4 py-3.5 text-xs text-muted-foreground md:table-cell">
                        {stat.lastDate
                          ? new Date(stat.lastDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "No orders yet"}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-9 gap-1"
                            title="Start billing for this customer"
                            onClick={() => handleBillCustomer(c)}
                          >
                            <ShoppingCart className="size-3.5" />
                            <span className="hidden sm:inline">Bill</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1"
                            title="View order history"
                            onClick={() => setHistoryCustomer(c)}
                          >
                            <History className="size-3.5" />
                            <span className="hidden sm:inline">History</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-9 p-0"
                            title="Edit customer details"
                            onClick={() => {
                              setIsNew(false);
                              setModalCustomer({ ...c });
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-9 p-0 text-destructive hover:bg-danger-soft hover:text-destructive"
                            title="Delete customer"
                            onClick={() => setDeleteCustomer(c)}
                          >
                            <Trash2 className="size-4" />
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

      {/* Add / Edit Customer Dialog */}
      <Dialog open={!!modalCustomer} onOpenChange={(open) => !open && setModalCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add sports customer" : "Edit customer details"}</DialogTitle>
          </DialogHeader>
          {modalCustomer && (
            <form onSubmit={handleSaveCustomer} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c-name">
                  Full name *
                </label>
                <input
                  id="c-name"
                  required
                  value={modalCustomer.name}
                  onChange={(e) => setModalCustomer({ ...modalCustomer, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c-phone">
                  Phone number (10 digits) *
                </label>
                <input
                  id="c-phone"
                  required
                  inputMode="tel"
                  value={modalCustomer.phone}
                  onChange={(e) =>
                    setModalCustomer({
                      ...modalCustomer,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  placeholder="e.g. 9876543210"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c-email">
                  Email address (optional)
                </label>
                <input
                  id="c-email"
                  type="email"
                  value={modalCustomer.email || ""}
                  onChange={(e) => setModalCustomer({ ...modalCustomer, email: e.target.value })}
                  placeholder="e.g. rahul@example.com"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c-address">
                  Area / Club / Address
                </label>
                <input
                  id="c-address"
                  value={modalCustomer.address || ""}
                  onChange={(e) => setModalCustomer({ ...modalCustomer, address: e.target.value })}
                  placeholder="e.g. Indiranagar, Bengaluru / Local Cricket Club"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="c-notes">
                  Player notes & preferences
                </label>
                <textarea
                  id="c-notes"
                  rows={2}
                  value={modalCustomer.notes || ""}
                  onChange={(e) => setModalCustomer({ ...modalCustomer, notes: e.target.value })}
                  placeholder="e.g. Bats right-handed, likes Yonex BG65 stringing at 26lbs"
                  className="w-full rounded-lg border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setModalCustomer(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isNew ? "Add customer" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase History Modal */}
      <Dialog open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Purchase History — {historyCustomer?.name}
            </DialogTitle>
            {historyCustomer && getCustomerSales(historyCustomer).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs mr-6"
                onClick={() => exportCustomerPurchasesToExcel(historyCustomer, sales)}
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                Export to Excel
              </Button>
            )}
          </DialogHeader>

          {historyCustomer && (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-wrap justify-between gap-2">
                <span>Phone: <b>{historyCustomer.phone}</b></span>
                {historyCustomer.email && <span>Email: <b>{historyCustomer.email}</b></span>}
                <span>Member since: <b>{new Date(historyCustomer.createdAt).toLocaleDateString("en-IN")}</b></span>
              </div>

              {getCustomerSales(historyCustomer).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No purchases recorded yet for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {getCustomerSales(historyCustomer).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border p-3 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{s.invoiceNo}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.date).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <Pill tone={s.payment === "Credit" ? "warning" : "primary"}>
                            {s.payment}
                          </Pill>
                          {s.status === "refunded" && <Pill tone="danger">Refunded</Pill>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-2 sm:pt-0">
                        <span className="text-base font-bold text-foreground">
                          {formatCurrency(s.total)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setViewSale(s)}
                        >
                          <Receipt className="size-3" />
                          View receipt
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Invoice Receipt Preview Modal */}
      {/* Professional Tax Invoice & Receipt Modal */}
      <InvoiceModal
        open={!!viewSale}
        onClose={() => setViewSale(null)}
        sale={viewSale}
        settings={settings}
      />

      {/* Delete Customer Alert Dialog */}
      <AlertDialog open={!!deleteCustomer} onOpenChange={(open) => !open && setDeleteCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete customer <b>{deleteCustomer?.name}</b>? Past sales
              records will retain their name, but the customer contact will be removed from your
              directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
