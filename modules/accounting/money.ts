import Decimal from "decimal.js";

export type MoneyInput = Decimal.Value;

const MONEY_DECIMAL_PLACES = 2;

export function toMoney(value: MoneyInput): Decimal {
  const amount = new Decimal(value);

  if (!amount.isFinite()) {
    throw new Error("Invalid money value");
  }

  return amount;
}

/** Round to 2 decimal places, half-up (the usual invoice rounding). */
export function roundMoney(value: MoneyInput): Decimal {
  return toMoney(value).toDecimalPlaces(
    MONEY_DECIMAL_PLACES,
    Decimal.ROUND_HALF_UP
  );
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>(
    (total, value) => total.plus(toMoney(value)),
    new Decimal(0)
  );
}

/** True when the value has no more than 2 decimal places. */
export function hasValidPrecision(value: MoneyInput): boolean {
  return toMoney(value).decimalPlaces() <= MONEY_DECIMAL_PLACES;
}

/** Display only. Never use the result for calculations. */
export function formatINR(value: MoneyInput): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(toMoney(value).toNumber());
}