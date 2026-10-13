import { describe, expect, it } from "vitest";
import { reverseLines, validateJournalLines } from "./journal-rules";

const balanced = [
  { accountId: "cash", debit: "1180.00", credit: "0" },
  { accountId: "sales", debit: "0", credit: "1000.00" },
  { accountId: "gst-output", debit: "0", credit: "180.00" },
];

describe("validateJournalLines", () => {
  it("accepts a balanced entry", () => {
    const result = validateJournalLines(balanced);
    expect(result).toEqual({
      ok: true,
      totalDebit: "1180.00",
      totalCredit: "1180.00",
    });
  });

  it("rejects an unbalanced entry", () => {
    const result = validateJournalLines([
      { accountId: "cash", debit: "100", credit: "0" },
      { accountId: "sales", debit: "0", credit: "99.99" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects fewer than two lines", () => {
    const result = validateJournalLines([
      { accountId: "cash", debit: "100", credit: "0" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects negative, empty and two-sided lines", () => {
    const base = { accountId: "cash", debit: "100", credit: "0" };

    expect(
      validateJournalLines([base, { accountId: "x", debit: "0", credit: "-100" }]).ok
    ).toBe(false);
    expect(
      validateJournalLines([base, { accountId: "x", debit: "0", credit: "0" }]).ok
    ).toBe(false);
    expect(
      validateJournalLines([base, { accountId: "x", debit: "5", credit: "5" }]).ok
    ).toBe(false);
  });

  it("rejects more than 2 decimal places instead of rounding silently", () => {
    const result = validateJournalLines([
      { accountId: "cash", debit: "10.005", credit: "0" },
      { accountId: "sales", debit: "0", credit: "10.005" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing account", () => {
    const result = validateJournalLines([
      { accountId: "", debit: "10", credit: "0" },
      { accountId: "sales", debit: "0", credit: "10" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("accepts penny-level amounts that would break float arithmetic", () => {
    const result = validateJournalLines([
      { accountId: "a", debit: "0.1", credit: "0" },
      { accountId: "b", debit: "0.2", credit: "0" },
      { accountId: "c", debit: "0", credit: "0.3" },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("reverseLines", () => {
  it("swaps debits and credits and stays balanced", () => {
    const reversed = reverseLines(balanced);
    expect(reversed[0]).toMatchObject({ accountId: "cash", debit: "0", credit: "1180.00" });
    expect(validateJournalLines(reversed).ok).toBe(true);
  });
});