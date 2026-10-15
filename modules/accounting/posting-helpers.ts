/**
 * Parses a date-only string (YYYY-MM-DD) into a Date at 00:00 UTC.
 * Returns null for anything that is not a real calendar date.
 * Date-only strings avoid time-zone surprises: 12 Oct stays 12 Oct everywhere.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? date : null;
}

/** Formats a Date as YYYY-MM-DD (UTC). */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Document number such as JV/2026-27/0001. */
export function formatEntryNumber(prefix: string, fiscalYear: string, sequence: number): string {
  return `${prefix}/${fiscalYear}/${String(sequence).padStart(4, "0")}`;
}