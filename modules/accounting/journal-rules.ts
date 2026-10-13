import { hasValidPrecision, sumMoney, toMoney, type MoneyInput } from "./money";

export type JournalLineInput = {
  accountId: string;
  debit: MoneyInput;
  credit: MoneyInput;
  description?: string;
};

export type JournalValidationResult =
  | { ok: true; totalDebit: string; totalCredit: string }
  | { ok: false; errors: string[] };

export function validateJournalLines(
  lines: JournalLineInput[]
): JournalValidationResult {
  const errors: string[] = [];

  if (lines.length < 2) {
    errors.push("A journal entry needs at least two lines.");
  }

  lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;

    if (!line.accountId) {
      errors.push(`${label}: account is required.`);
    }

    let debit;
    let credit;

    try {
      debit = toMoney(line.debit);
      credit = toMoney(line.credit);
    } catch {
      errors.push(`${label}: amounts must be valid numbers.`);
      return;
    }

    if (debit.isNegative() || credit.isNegative()) {
      errors.push(`${label}: amounts cannot be negative.`);
    } else if (!hasValidPrecision(debit) || !hasValidPrecision(credit)) {
      errors.push(`${label}: amounts can have at most 2 decimal places.`);
    } else if (debit.isZero() && credit.isZero()) {
      errors.push(`${label}: enter either a debit or a credit amount.`);
    } else if (debit.gt(0) && credit.gt(0)) {
      errors.push(`${label}: a line cannot have both a debit and a credit.`);
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const totalDebit = sumMoney(lines.map((line) => line.debit));
  const totalCredit = sumMoney(lines.map((line) => line.credit));

  if (!totalDebit.equals(totalCredit)) {
    return {
      ok: false,
      errors: [
        `Entry is not balanced: debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}.`,
      ],
    };
  }

  return {
    ok: true,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
  };
}

/** Builds the lines of a reversing entry: debits and credits swapped. */
export function reverseLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    description: line.description ? `Reversal: ${line.description}` : "Reversal",
  }));
}