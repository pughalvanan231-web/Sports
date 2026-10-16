import { toast } from "sonner";
import type { Customer, Sale } from "./store";

/**
 * Downloads a spreadsheet file compatible with Microsoft Excel, Google Sheets, etc.
 * Prepends \uFEFF (UTF-8 BOM) so Excel automatically recognizes UTF-8 (rupee symbols, names, accents)
 * without encoding glitches.
 */
export function downloadExcelCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number | undefined | null): string => {
    if (cell === undefined || cell === null) return "";
    const str = String(cell);
    // If it contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    "\uFEFF" + // UTF-8 Byte Order Mark for Excel
    [headers.map(escapeCell).join(","), ...rows.map((row) => row.map(escapeCell).join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${link.download} for Excel!`);
}

/**
 * Export all customers and their aggregate purchase summary to Excel
 */
export function exportCustomersToExcel(customers: Customer[], sales: Sale[]) {
  const map = new Map<string, { totalSpend: number; ordersCount: number; lastDate: string | null; creditDue: number }>();

  for (const c of customers) {
    map.set(c.phone || c.id, { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 });
  }

  for (const s of sales) {
    if (s.status === "refunded") continue;
    const key = s.customerPhone || s.customerName;
    let stat = map.get(key);
    if (!stat) {
      stat = { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
      map.set(key, stat);
    }
    stat.totalSpend += s.total;
    stat.ordersCount += 1;
    if (s.payment === "Credit") stat.creditDue += s.total;
    if (!stat.lastDate || new Date(s.date) > new Date(stat.lastDate)) {
      stat.lastDate = s.date;
    }
  }

  const headers = [
    "Customer ID",
    "Customer Name",
    "Phone Number",
    "Email Address",
    "Area / Address",
    "Player Preferences / Notes",
    "Registration Date",
    "Total Orders Placed",
    "Total Spend (INR)",
    "Outstanding Store Credit Due (INR)",
    "Last Visit Date",
  ];

  const rows = customers.map((c) => {
    const stat = map.get(c.phone) || { totalSpend: 0, ordersCount: 0, lastDate: null, creditDue: 0 };
    return [
      c.id,
      c.name,
      `="${c.phone}"`, // Format as text in Excel so leading zero isn't stripped
      c.email || "",
      c.address || "",
      c.notes || "",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "",
      stat.ordersCount,
      stat.totalSpend.toFixed(2),
      stat.creditDue.toFixed(2),
      stat.lastDate ? new Date(stat.lastDate).toLocaleDateString("en-IN") : "Never",
    ];
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadExcelCSV(`customers_list_${dateStr}.csv`, headers, rows);
}

/**
 * Export full itemized purchase history of a specific customer to Excel
 */
export function exportCustomerPurchasesToExcel(customer: Customer, sales: Sale[]) {
  const custSales = sales.filter(
    (s) => s.customerPhone === customer.phone || (s.customerName && s.customerName.toLowerCase() === customer.name.toLowerCase())
  );

  const headers = [
    "Invoice No",
    "Date & Time",
    "Customer Name",
    "Customer Phone",
    "Item Name",
    "Unit Price (INR)",
    "Quantity",
    "Line Total (INR)",
    "Invoice Subtotal (INR)",
    "Invoice Discount (INR)",
    "Invoice GST (INR)",
    "Invoice Final Total (INR)",
    "Payment Method",
    "Invoice Status",
  ];

  const rows: (string | number)[][] = [];

  custSales.forEach((s) => {
    s.items.forEach((item) => {
      rows.push([
        s.invoiceNo,
        new Date(s.date).toLocaleString("en-IN"),
        s.customerName,
        `="${s.customerPhone}"`,
        item.name,
        item.price.toFixed(2),
        item.qty,
        (item.price * item.qty).toFixed(2),
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.tax.toFixed(2),
        s.total.toFixed(2),
        s.payment,
        s.status || "completed",
      ]);
    });
  });

  const cleanName = customer.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  downloadExcelCSV(`customer_purchases_${cleanName}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

/**
 * Export master purchases register (all sales with items) to Excel
 */
export function exportMasterPurchasesToExcel(sales: Sale[]) {
  const headers = [
    "Invoice No",
    "Date & Time",
    "Customer Name",
    "Customer Phone",
    "Item Name",
    "Unit Price (INR)",
    "Quantity",
    "Line Total (INR)",
    "Invoice Subtotal (INR)",
    "Invoice Discount (INR)",
    "Invoice Tax (INR)",
    "Invoice Total (INR)",
    "Payment Method",
    "Status",
  ];

  const rows: (string | number)[][] = [];

  sales.forEach((s) => {
    s.items.forEach((item) => {
      rows.push([
        s.invoiceNo,
        new Date(s.date).toLocaleString("en-IN"),
        s.customerName || "Walk-in",
        s.customerPhone ? `="${s.customerPhone}"` : "",
        item.name,
        item.price.toFixed(2),
        item.qty,
        (item.price * item.qty).toFixed(2),
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.tax.toFixed(2),
        s.total.toFixed(2),
        s.payment,
        s.status || "completed",
      ]);
    });
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadExcelCSV(`master_purchases_${dateStr}.csv`, headers, rows);
}
