import { useSyncExternalStore } from "react";

export type Product = {
  id: string; name: string; sku: string; barcode: string; category: string;
  price: number; cost: number; tax: number; stock: number; lowStock: number; active: boolean;
};
export type Customer = {
  id: string; name: string; phone: string; email?: string; address?: string; notes?: string; createdAt: string;
};
export type SaleItem = { productId: string; name: string; price: number; qty: number; tax: number; cost: number };
export type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank" | "Credit";
export type Sale = {
  id: string; invoiceNo: string; date: string; customerName: string; customerPhone: string;
  items: SaleItem[]; subtotal: number; discount: number; tax: number; total: number; payment: PaymentMethod;
  status?: "completed" | "refunded";
};
export type Settings = {
  shopName: string; address: string; phone: string; email?: string; gstin: string;
  invoicePrefix: string; invoiceFooter: string; paperSize: "80mm" | "A4";
  defaultTax: number; taxInclusive: boolean; theme: "light" | "dark";
};
export type Movement = { id: string; productId: string; qty: number; reason: string; date: string };
export type DB = { products: Product[]; customers: Customer[]; sales: Sale[]; settings: Settings; movements: Movement[] };

export const uid = () => Math.random().toString(36).slice(2, 10);
export const genBarcode = () => "89" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");

const P = (name: string, category: string, price: number, cost: number, stock: number, i: number): Product => ({
  id: "p" + i, name, category, price, cost, stock, tax: 18, lowStock: 5, active: true,
  sku: category.slice(0, 3).toUpperCase() + "-" + String(100 + i), barcode: "8901000" + String(10000 + i),
});

export const seedProducts: Product[] = [
  P("SG Cricket Bat English Willow", "Cricket", 8499, 6200, 12, 1),
  P("Leather Cricket Ball (Pack of 2)", "Cricket", 649, 380, 40, 2),
  P("Batting Gloves Pro Grade", "Cricket", 1899, 1200, 3, 3),
  P("Nivia Football Size 5 Storm", "Football", 1199, 700, 25, 4),
  P("Football Studs Kids Pro", "Football", 2299, 1500, 0, 5),
  P("Yonex Astrox Badminton Racket", "Badminton", 3499, 2400, 9, 6),
  P("Mavis 350 Shuttlecock (Tube of 6)", "Badminton", 899, 550, 4, 7),
  P("Pro Stride Running Shoes Men", "Footwear", 4299, 2900, 15, 8),
  P("Eco Grip Yoga Mat 6mm", "Fitness", 999, 520, 30, 9),
  P("Rubber Coated Hex Dumbbell 5kg Pair", "Fitness", 1799, 1100, 2, 10),
  P("Sports Hydration Water Bottle 1L", "Accessories", 399, 180, 60, 11),
  P("Wilson Championship Tennis Balls (3-pack)", "Tennis", 549, 320, 18, 12),
];

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const seedCustomers: Customer[] = [
  { id: "c1", name: "Rahul Sharma", phone: "9876543210", email: "rahul.sharma@example.com", address: "Indiranagar, Bengaluru", notes: "Regular cricket player, plays for local club", createdAt: daysAgo(45) },
  { id: "c2", name: "Priya Nair", phone: "9123456780", email: "priya.nair@example.com", address: "Koramangala, Bengaluru", notes: "Badminton enthusiast, state level trainee", createdAt: daysAgo(35) },
  { id: "c3", name: "Arjun Mehta", phone: "9988776655", email: "arjun.m@example.com", address: "Whitefield, Bengaluru", notes: "Buys running shoes & fitness accessories", createdAt: daysAgo(25) },
  { id: "c4", name: "Sneha Patel", phone: "9811223344", email: "sneha.p@example.com", address: "HSR Layout, Bengaluru", notes: "Yoga & athletics instructor", createdAt: daysAgo(18) },
  { id: "c5", name: "Vikram Singh", phone: "9700112233", email: "vikram.s@example.com", address: "Jayanagar, Bengaluru", notes: "Football club coach", createdAt: daysAgo(12) },
];

const seedSales: Sale[] = [
  {
    id: "s1", invoiceNo: "NX-1001", date: daysAgo(22),
    customerName: "Rahul Sharma", customerPhone: "9876543210",
    items: [{ productId: "p1", name: "SG Cricket Bat English Willow", price: 8499, qty: 1, tax: 18, cost: 6200 }],
    subtotal: 8499, discount: 0, tax: 1296.46, total: 8499, payment: "UPI", status: "completed",
  },
  {
    id: "s2", invoiceNo: "NX-1002", date: daysAgo(20),
    customerName: "Priya Nair", customerPhone: "9123456780",
    items: [
      { productId: "p6", name: "Yonex Astrox Badminton Racket", price: 3499, qty: 1, tax: 18, cost: 2400 },
      { productId: "p7", name: "Mavis 350 Shuttlecock (Tube of 6)", price: 899, qty: 2, tax: 18, cost: 550 },
    ],
    subtotal: 5297, discount: 200, tax: 777.51, total: 5097, payment: "Card", status: "completed",
  },
  {
    id: "s3", invoiceNo: "NX-1003", date: daysAgo(18),
    customerName: "Walk-in", customerPhone: "",
    items: [{ productId: "p4", name: "Nivia Football Size 5 Storm", price: 1199, qty: 1, tax: 18, cost: 700 }],
    subtotal: 1199, discount: 0, tax: 182.9, total: 1199, payment: "Cash", status: "completed",
  },
  {
    id: "s4", invoiceNo: "NX-1004", date: daysAgo(15),
    customerName: "Arjun Mehta", customerPhone: "9988776655",
    items: [{ productId: "p8", name: "Pro Stride Running Shoes Men", price: 4299, qty: 1, tax: 18, cost: 2900 }],
    subtotal: 4299, discount: 300, tax: 610.02, total: 3999, payment: "UPI", status: "completed",
  },
  {
    id: "s5", invoiceNo: "NX-1005", date: daysAgo(13),
    customerName: "Sneha Patel", customerPhone: "9811223344",
    items: [
      { productId: "p9", name: "Eco Grip Yoga Mat 6mm", price: 999, qty: 2, tax: 18, cost: 520 },
      { productId: "p11", name: "Sports Hydration Water Bottle 1L", price: 399, qty: 1, tax: 18, cost: 180 },
    ],
    subtotal: 2397, discount: 0, tax: 365.64, total: 2397, payment: "UPI", status: "completed",
  },
  {
    id: "s6", invoiceNo: "NX-1006", date: daysAgo(11),
    customerName: "Vikram Singh", customerPhone: "9700112233",
    items: [{ productId: "p4", name: "Nivia Football Size 5 Storm", price: 1199, qty: 5, tax: 18, cost: 700 }],
    subtotal: 5995, discount: 500, tax: 838.22, total: 5495, payment: "Credit", status: "completed",
  },
  {
    id: "s7", invoiceNo: "NX-1007", date: daysAgo(9),
    customerName: "Walk-in", customerPhone: "",
    items: [{ productId: "p12", name: "Wilson Championship Tennis Balls (3-pack)", price: 549, qty: 2, tax: 18, cost: 320 }],
    subtotal: 1098, discount: 0, tax: 167.5, total: 1098, payment: "Cash", status: "completed",
  },
  {
    id: "s8", invoiceNo: "NX-1008", date: daysAgo(7),
    customerName: "Rahul Sharma", customerPhone: "9876543210",
    items: [
      { productId: "p2", name: "Leather Cricket Ball (Pack of 2)", price: 649, qty: 3, tax: 18, cost: 380 },
      { productId: "p3", name: "Batting Gloves Pro Grade", price: 1899, qty: 1, tax: 18, cost: 1200 },
    ],
    subtotal: 3846, discount: 0, tax: 586.68, total: 3846, payment: "UPI", status: "completed",
  },
  {
    id: "s9", invoiceNo: "NX-1009", date: daysAgo(5),
    customerName: "Priya Nair", customerPhone: "9123456780",
    items: [{ productId: "p7", name: "Mavis 350 Shuttlecock (Tube of 6)", price: 899, qty: 3, tax: 18, cost: 550 }],
    subtotal: 2697, discount: 100, tax: 396.15, total: 2597, payment: "Card", status: "completed",
  },
  {
    id: "s10", invoiceNo: "NX-1010", date: daysAgo(4),
    customerName: "Walk-in", customerPhone: "",
    items: [{ productId: "p10", name: "Rubber Coated Hex Dumbbell 5kg Pair", price: 1799, qty: 1, tax: 18, cost: 1100 }],
    subtotal: 1799, discount: 0, tax: 274.42, total: 1799, payment: "UPI", status: "completed",
  },
  {
    id: "s11", invoiceNo: "NX-1011", date: daysAgo(3),
    customerName: "Arjun Mehta", customerPhone: "9988776655",
    items: [{ productId: "p11", name: "Sports Hydration Water Bottle 1L", price: 399, qty: 2, tax: 18, cost: 180 }],
    subtotal: 798, discount: 0, tax: 121.73, total: 798, payment: "Cash", status: "completed",
  },
  {
    id: "s12", invoiceNo: "NX-1012", date: daysAgo(2),
    customerName: "Walk-in", customerPhone: "",
    items: [{ productId: "p6", name: "Yonex Astrox Badminton Racket", price: 3499, qty: 1, tax: 18, cost: 2400 }],
    subtotal: 3499, discount: 0, tax: 533.75, total: 3499, payment: "Card", status: "completed",
  },
  {
    id: "s13", invoiceNo: "NX-1013", date: daysAgo(1),
    customerName: "Rahul Sharma", customerPhone: "9876543210",
    items: [{ productId: "p2", name: "Leather Cricket Ball (Pack of 2)", price: 649, qty: 2, tax: 18, cost: 380 }],
    subtotal: 1298, discount: 0, tax: 197.99, total: 1298, payment: "UPI", status: "completed",
  },
  {
    id: "s14", invoiceNo: "NX-1014", date: new Date().toISOString(),
    customerName: "Sneha Patel", customerPhone: "9811223344",
    items: [{ productId: "p9", name: "Eco Grip Yoga Mat 6mm", price: 999, qty: 1, tax: 18, cost: 520 }],
    subtotal: 999, discount: 50, tax: 144.76, total: 949, payment: "UPI", status: "completed",
  },
];

export const seedSettings: Settings = {
  shopName: "Nexus Sports",
  address: "12 MG Road, Bengaluru, Karnataka 560001",
  phone: "080-4000-1234",
  email: "contact@nexussports.in",
  gstin: "29ABCDE1234F1Z5",
  invoicePrefix: "NX-",
  invoiceFooter: "Thank you for shopping with us! Play hard, stay fit.",
  paperSize: "80mm",
  defaultTax: 18,
  taxInclusive: true,
  theme: "light",
};

export const seed: DB = {
  products: seedProducts,
  customers: seedCustomers,
  sales: seedSales,
  settings: seedSettings,
  movements: [],
};

const KEY = "nexus-pos-db-v1";
let state: DB = seed;
let saveStatus: "idle" | "saving" | "saved" = "idle";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let loaded = false;

export function initStore() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        ...seed,
        ...parsed,
        settings: { ...seed.settings, ...(parsed.settings || {}) },
      };
    }
  } catch { /* ignore */ }
  emit();
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function update(fn: (db: DB) => DB) {
  state = fn(state);
  saveStatus = "saving";
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* ignore */ }
    saveStatus = "saved";
    emit();
  }, 350);
}

export function resetData() { update(() => seed); }
export function clearAllData() {
  update((d) => ({
    ...d,
    products: [],
    customers: [],
    sales: [],
    movements: [],
  }));
}
export const getDB = () => state;

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useDB<T>(sel: (db: DB) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(seed));
}
export function useSaveStatus() {
  return useSyncExternalStore(subscribe, () => saveStatus, () => "idle" as const);
}

export const formatCurrency = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const stockStatus = (p: Product) => (p.stock <= 0 ? "out" : p.stock <= p.lowStock ? "low" : "in");

export function nextInvoiceNo(db: DB) {
  const nums = db.sales.map((s) => parseInt(s.invoiceNo.replace(/\D/g, ""), 10) || 0);
  return db.settings.invoicePrefix + (Math.max(1000, ...nums) + 1);
}

/** Totals: prices are tax-inclusive when settings.taxInclusive. Discount applies before tax extraction. */
export function computeTotals(items: SaleItem[], discount: number, taxInclusive: boolean) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const d = Math.min(Math.max(discount, 0), subtotal);
  const ratio = subtotal ? (subtotal - d) / subtotal : 0;
  let tax = 0;
  for (const i of items) {
    const line = i.price * i.qty * ratio;
    tax += taxInclusive ? line - line / (1 + i.tax / 100) : line * (i.tax / 100);
  }
  tax = Math.round(tax * 100) / 100;
  const total = Math.round((taxInclusive ? subtotal - d : subtotal - d + tax) * 100) / 100;
  return { subtotal, discount: d, tax, total };
}

/** Refund a sale and restore stock */
export function refundSale(saleId: string) {
  update((d) => {
    const sale = d.sales.find((s) => s.id === saleId);
    if (!sale || sale.status === "refunded") return d;
    return {
      ...d,
      sales: d.sales.map((s) => (s.id === saleId ? { ...s, status: "refunded" as const } : s)),
      products: d.products.map((p) => {
        const item = sale.items.find((i) => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.qty } : p;
      }),
      movements: [
        ...d.movements,
        ...sale.items.map((i) => ({
          id: uid(),
          productId: i.productId,
          qty: i.qty,
          reason: `Refund for ${sale.invoiceNo}`,
          date: new Date().toISOString(),
        })),
      ],
    };
  });
}

/** Delete a sale record */
export function deleteSale(saleId: string, restock: boolean = false) {
  update((d) => {
    const sale = d.sales.find((s) => s.id === saleId);
    if (!sale) return d;
    return {
      ...d,
      sales: d.sales.filter((s) => s.id !== saleId),
      products: restock
        ? d.products.map((p) => {
            const item = sale.items.find((i) => i.productId === p.id);
            return item ? { ...p, stock: p.stock + item.qty } : p;
          })
        : d.products,
    };
  });
}

/** Export full JSON backup */
export function exportBackupJSON(): string {
  return JSON.stringify(state, null, 2);
}

/** Import JSON backup with schema check */
export function importBackupJSON(jsonStr: string): { ok: boolean; message: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== "object") return { ok: false, message: "Invalid JSON format" };
    if (!Array.isArray(data.products) || !Array.isArray(data.sales)) {
      return { ok: false, message: "Backup is missing required products or sales tables" };
    }
    update(() => ({
      products: data.products ?? [],
      customers: Array.isArray(data.customers) ? data.customers : [],
      sales: data.sales ?? [],
      settings: { ...seedSettings, ...(data.settings || {}) },
      movements: Array.isArray(data.movements) ? data.movements : [],
    }));
    return { ok: true, message: "Backup restored successfully!" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error parsing JSON";
    return { ok: false, message: msg };
  }
}

