import { describe, expect, it } from "vitest";
import { formatINR, hasValidPrecision, roundMoney, sumMoney } from "./money";

describe("money", () => {
  it("adds decimals without floating point error", () => {
    expect(sumMoney(["0.1", "0.2"]).toFixed(2)).toBe("0.30");
    expect(sumMoney([0.1, 0.2]).toFixed(2)).toBe("0.30");
  });

  it("rounds half up to 2 decimal places", () => {
    expect(roundMoney("1.005").toFixed(2)).toBe("1.01");
    expect(roundMoney("2.675").toFixed(2)).toBe("2.68");
    expect(roundMoney("10.004").toFixed(2)).toBe("10.00");
  });

  it("checks precision", () => {
    expect(hasValidPrecision("10.25")).toBe(true);
    expect(hasValidPrecision("10.255")).toBe(false);
  });

  it("rejects invalid values", () => {
    expect(() => roundMoney("abc")).toThrow();
    expect(() => roundMoney(Infinity)).toThrow();
  });

  it("formats with Indian digit grouping", () => {
    expect(formatINR("1234567.5")).toBe("₹12,34,567.50");
  });
});