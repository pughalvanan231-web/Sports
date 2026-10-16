import { describe, expect, it } from "vitest";
import { computeTotals, formatCurrency } from "./store";

describe("billing totals", () => {
  it("tax-inclusive: total equals subtotal minus discount", () => {
    const t = computeTotals([{ productId: "a", name: "x", price: 1180, qty: 1, tax: 18, cost: 0 }], 0, true);
    expect(t.total).toBe(1180);
    expect(t.tax).toBe(180);
  });
  it("discount cannot exceed subtotal", () => {
    const t = computeTotals([{ productId: "a", name: "x", price: 100, qty: 1, tax: 18, cost: 0 }], 500, true);
    expect(t.total).toBe(0);
  });
  it("uses Indian number format with ₹", () => {
    expect(formatCurrency(1234567)).toBe("₹12,34,567");
  });

  it("handles backup export and import validation", async () => {
    const { exportBackupJSON, importBackupJSON } = await import("./store");
    const json = exportBackupJSON();
    expect(json).toContain("Nexus Sports");
    const res = importBackupJSON(json);
    expect(res.ok).toBe(true);

    const badRes = importBackupJSON("invalid json");
    expect(badRes.ok).toBe(false);
  });
});

