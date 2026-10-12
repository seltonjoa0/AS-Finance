import { isCivilDate } from "@/features/finance/dates";

type CivilDateParts = {
  year: number;
  month: number;
  day: number;
};

export type CreditCardInvoiceCycle = {
  closingDate: string;
  dueDate: string;
};

export type CreditCardLimit = {
  usedCents: bigint;
  availableCents: bigint;
  overLimitCents: bigint;
};

function parseCivilDate(value: string): CivilDateParts {
  if (!isCivilDate(value)) {
    throw new Error("A data da compra deve ser uma data civil válida.");
  }

  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function validateCardDay(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error(`${fieldName} deve ser um inteiro entre 1 e 31.`);
  }
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function nextMonth({ year, month }: Pick<CivilDateParts, "year" | "month">) {
  if (month < 12) return { year, month: month + 1 };
  if (year >= 9999) {
    throw new Error("O ciclo da fatura ultrapassa o intervalo de datas suportado.");
  }
  return { year: year + 1, month: 1 };
}

function cardDateForMonth(
  month: Pick<CivilDateParts, "year" | "month">,
  configuredDay: number,
) {
  const day = Math.min(configuredDay, daysInMonth(month.year, month.month));
  return `${month.year.toString().padStart(4, "0")}-${month.month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * Resolve o ciclo da fatura usando apenas datas civis. Dias inexistentes são
 * ajustados para o último dia do mês, sempre a partir do dia-base configurado.
 */
export function resolveCreditCardInvoiceCycle({
  purchaseDate,
  closingDay,
  dueDay,
}: {
  purchaseDate: string;
  closingDay: number;
  dueDay: number;
}): CreditCardInvoiceCycle {
  const purchase = parseCivilDate(purchaseDate);
  validateCardDay(closingDay, "O dia de fechamento");
  validateCardDay(dueDay, "O dia de vencimento");

  let closingMonth = { year: purchase.year, month: purchase.month };
  let closingDate = cardDateForMonth(closingMonth, closingDay);

  // Uma compra realizada no fechamento ainda pertence ao ciclo atual.
  if (purchaseDate > closingDate) {
    closingMonth = nextMonth(closingMonth);
    closingDate = cardDateForMonth(closingMonth, closingDay);
  }

  let dueMonth = closingMonth;
  let dueDate = cardDateForMonth(dueMonth, dueDay);

  if (dueDate <= closingDate) {
    dueMonth = nextMonth(dueMonth);
    dueDate = cardDateForMonth(dueMonth, dueDay);
  }

  return { closingDate, dueDate };
}

/**
 * Calcula o uso do limite a partir do saldo contábil da conta do cartão.
 * Saldo negativo representa crédito consumido; saldo positivo não consome limite.
 */
export function calculateCreditCardLimit({
  limitCents,
  accountBalanceCents,
}: {
  limitCents: bigint;
  accountBalanceCents: bigint;
}): CreditCardLimit {
  if (limitCents < 0n) {
    throw new Error("O limite não pode ser negativo.");
  }

  const usedCents = accountBalanceCents < 0n ? -accountBalanceCents : 0n;

  return {
    usedCents,
    availableCents: limitCents > usedCents ? limitCents - usedCents : 0n,
    overLimitCents: usedCents > limitCents ? usedCents - limitCents : 0n,
  };
}
