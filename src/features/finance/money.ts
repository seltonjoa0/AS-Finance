const MONEY_PATTERN = /^-?\d{1,15}(?:\.\d{1,2})?$/;

function normalizeMoneyInput(value: string) {
  const compact = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");

  if (compact.includes(",") && compact.includes(".")) {
    return compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  }

  if (compact.includes(",")) return compact.replace(/\./g, "").replace(",", ".");
  return compact;
}

export function parseMoneyToCents(value: string, allowNegative = false) {
  const normalized = normalizeMoneyInput(value);
  if (!MONEY_PATTERN.test(normalized)) return null;

  const negative = normalized.startsWith("-");
  if (negative && !allowNegative) return null;

  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function centsToDecimal(cents: bigint) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function decimalToCents(value: { toString(): string } | string) {
  const parsed = parseMoneyToCents(value.toString(), true);
  if (parsed === null) throw new Error("Valor monetário fora do formato esperado.");
  return parsed;
}

export function formatCents(cents: bigint, currency = "BRL") {
  if (currency !== "BRL") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(Number(cents) / 100);
  }

  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}R$ ${whole},${fraction}`;
}

export function splitEqually(totalCents: bigint, memberIds: string[]) {
  if (memberIds.length === 0) throw new Error("É necessário ao menos um membro.");

  const count = BigInt(memberIds.length);
  const base = totalCents / count;
  let remainder = totalCents % count;

  return memberIds.map((memberId) => {
    const extra = remainder > 0n ? 1n : 0n;
    if (remainder > 0n) remainder -= 1n;
    return { memberId, cents: base + extra };
  });
}

export function calculateAccountBalanceCents({
  openingCents,
  incomeCents,
  expenseCents,
  incomingTransferCents = 0n,
  outgoingTransferCents = 0n,
  netTransferCents = 0n,
}: {
  openingCents: bigint;
  incomeCents: bigint;
  expenseCents: bigint;
  incomingTransferCents?: bigint;
  outgoingTransferCents?: bigint;
  netTransferCents?: bigint;
}) {
  return (
    openingCents +
    incomeCents -
    expenseCents +
    incomingTransferCents -
    outgoingTransferCents +
    netTransferCents
  );
}
