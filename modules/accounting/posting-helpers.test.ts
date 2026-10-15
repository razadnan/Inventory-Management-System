import { describe, expect, it } from "vitest";
import { formatEntryNumber, parseDateOnly, toDateOnlyString } from "./posting-helpers";

describe("parseDateOnly", () => {
  it("parses a valid date at midnight UTC", () => {
    const date = parseDateOnly("2026-10-12");
    expect(date?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("rejects impossible dates and wrong formats", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("12-10-2026")).toBeNull();
    expect(parseDateOnly("2026-10-12T10:00:00Z")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseDateOnly("2028-02-29")).not.toBeNull();
    expect(parseDateOnly("2027-02-29")).toBeNull();
  });
});

describe("toDateOnlyString", () => {
  it("round-trips with parseDateOnly", () => {
    expect(toDateOnlyString(parseDateOnly("2027-03-31")!)).toBe("2027-03-31");
  });
});

describe("formatEntryNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatEntryNumber("JV", "2026-27", 1)).toBe("JV/2026-27/0001");
    expect(formatEntryNumber("JV", "2026-27", 123)).toBe("JV/2026-27/0123");
  });

  it("keeps a numbered invoice within 16 characters", () => {
    expect(formatEntryNumber("INV", "2026-27", 9999).length).toBeLessThanOrEqual(16);
  });
});