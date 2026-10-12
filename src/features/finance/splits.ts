import { parseMoneyToCents, splitEqually } from "@/features/finance/money";

const PERCENTAGE_DECIMALS = 4;
const PERCENTAGE_SCALE = 10n ** BigInt(PERCENTAGE_DECIMALS);
const FULL_PERCENTAGE = 100n * PERCENTAGE_SCALE;
const PERCENTAGE_PATTERN = /^\d{1,3}(?:[.,]\d{1,4})?$/;

export type SupportedSplitMethod =
  | "INDIVIDUAL"
  | "EQUAL"
  | "PERCENTAGE"
  | "CUSTOM"
  | "INCOME_BASED";

export type SplitDetail = {
  memberId: string;
  value: string;
};

export type TransactionSplitValue = {
  memberId: string;
  cents: bigint;
  percentage?: string;
};

type BuildTransactionSplitsInput = {
  method: SupportedSplitMethod;
  totalCents: bigint;
  memberIds: string[];
  responsibleMemberId?: string;
  details: SplitDetail[];
};

type BuildTransactionSplitsResult =
  | { success: true; splits: TransactionSplitValue[] }
  | { success: false; message: string };

export function parsePercentageUnits(value: string) {
  const normalized = value.trim();
  if (!PERCENTAGE_PATTERN.test(normalized)) return null;

  const [whole = "0", fraction = ""] = normalized.replace(",", ".").split(".");
  const units = BigInt(whole) * PERCENTAGE_SCALE + BigInt(fraction.padEnd(PERCENTAGE_DECIMALS, "0"));
  return units <= FULL_PERCENTAGE ? units : null;
}

export function percentageUnitsToDecimal(units: bigint) {
  const whole = units / PERCENTAGE_SCALE;
  const fraction = String(units % PERCENTAGE_SCALE).padStart(PERCENTAGE_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

export function formatPercentageInput(units: bigint) {
  const [whole = "0", fraction = ""] = percentageUnitsToDecimal(units).split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole},${trimmedFraction}` : whole;
}

export function equalPercentageInputs(memberIds: string[]) {
  if (memberIds.length === 0) return {};

  const count = BigInt(memberIds.length);
  const base = FULL_PERCENTAGE / count;
  const remainder = FULL_PERCENTAGE % count;

  return Object.fromEntries(
    memberIds.map((memberId, index) => [
      memberId,
      formatPercentageInput(base + (BigInt(index) < remainder ? 1n : 0n)),
    ]),
  );
}

export function parseSplitDetails(value: string): SplitDetail[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 100) return null;

    const details: SplitDetail[] = [];
    for (const item of parsed) {
      const record = item as Record<string, unknown> | null;
      if (
        typeof item !== "object" ||
        item === null ||
        typeof record?.memberId !== "string" ||
        typeof record.value !== "string"
      ) {
        return null;
      }

      details.push({
        memberId: record.memberId,
        value: record.value,
      });
    }

    return details;
  } catch {
    return null;
  }
}

function validateDetailMembers(details: SplitDetail[], memberIds: string[]) {
  if (details.length !== memberIds.length) return false;

  const activeMemberIds = new Set(memberIds);
  const receivedMemberIds = new Set(details.map((detail) => detail.memberId));

  return (
    receivedMemberIds.size === details.length &&
    details.every((detail) => activeMemberIds.has(detail.memberId))
  );
}

function buildPercentageSplits(
  totalCents: bigint,
  details: SplitDetail[],
): BuildTransactionSplitsResult {
  const parsed = details.map((detail, index) => ({
    ...detail,
    index,
    units: parsePercentageUnits(detail.value),
  }));

  if (parsed.some((detail) => detail.units === null)) {
    return { success: false, message: "Informe percentuais válidos, com até 4 casas decimais." };
  }

  const totalUnits = parsed.reduce((sum, detail) => sum + detail.units!, 0n);
  if (totalUnits !== FULL_PERCENTAGE) {
    return { success: false, message: "A soma dos percentuais deve ser exatamente 100%." };
  }

  const positive = parsed
    .filter((detail) => detail.units! > 0n)
    .map((detail) => {
      const rawShare = totalCents * detail.units!;
      return {
        ...detail,
        cents: rawShare / FULL_PERCENTAGE,
        remainder: rawShare % FULL_PERCENTAGE,
      };
    });

  const allocated = positive.reduce((sum, detail) => sum + detail.cents, 0n);
  const missingCents = totalCents - allocated;
  const priority = [...positive].sort(
    (left, right) =>
      Number(right.remainder - left.remainder) || left.index - right.index,
  );
  const receivesExtra = new Set(priority.slice(0, Number(missingCents)).map((detail) => detail.index));

  const splits = positive.map((detail) => ({
    memberId: detail.memberId,
    cents: detail.cents + (receivesExtra.has(detail.index) ? 1n : 0n),
    percentage: percentageUnitsToDecimal(detail.units!),
  }));

  if (splits.some((split) => split.cents === 0n)) {
    return {
      success: false,
      message: "O valor é baixo demais para atribuir ao menos R$ 0,01 a cada percentual informado.",
    };
  }

  return { success: true, splits };
}

function buildCustomSplits(
  totalCents: bigint,
  details: SplitDetail[],
): BuildTransactionSplitsResult {
  const parsed = details.map((detail) => ({
    memberId: detail.memberId,
    cents: parseMoneyToCents(detail.value),
  }));

  if (parsed.some((detail) => detail.cents === null)) {
    return { success: false, message: "Informe valores válidos para todas as pessoas." };
  }

  const customTotal = parsed.reduce((sum, detail) => sum + detail.cents!, 0n);
  if (customTotal !== totalCents) {
    return { success: false, message: "A soma da divisão deve ser igual ao valor da movimentação." };
  }

  const splits = parsed
    .filter((detail) => detail.cents! > 0n)
    .map((detail) => ({ memberId: detail.memberId, cents: detail.cents! }));

  if (splits.length === 0) {
    return { success: false, message: "Atribua um valor maior que zero a pelo menos uma pessoa." };
  }

  return { success: true, splits };
}

function allocateByWeight(
  total: bigint,
  entries: Array<{ index: number; weight: bigint }>,
  totalWeight: bigint,
) {
  const allocated = entries.map((entry) => {
    const rawShare = total * entry.weight;
    return {
      ...entry,
      value: rawShare / totalWeight,
      remainder: rawShare % totalWeight,
    };
  });
  const allocatedTotal = allocated.reduce((sum, entry) => sum + entry.value, 0n);
  const remaining = total - allocatedTotal;
  const priority = [...allocated].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  const receivesExtra = new Set(
    priority.slice(0, Number(remaining)).map((entry) => entry.index),
  );

  return new Map(
    allocated.map((entry) => [
      entry.index,
      entry.value + (receivesExtra.has(entry.index) ? 1n : 0n),
    ]),
  );
}

function buildIncomeBasedSplits(
  totalCents: bigint,
  details: SplitDetail[],
): BuildTransactionSplitsResult {
  const parsed = details.map((detail, index) => ({
    ...detail,
    index,
    incomeCents: parseMoneyToCents(detail.value),
  }));

  if (parsed.some((detail) => detail.incomeCents === null)) {
    return {
      success: false,
      message: "Informe uma renda vigente válida para todas as pessoas.",
    };
  }

  const totalIncome = parsed.reduce((sum, detail) => sum + detail.incomeCents!, 0n);
  if (totalIncome === 0n) {
    return {
      success: false,
      message: "A renda total vigente precisa ser maior que zero.",
    };
  }

  const weighted = parsed
    .filter((detail) => detail.incomeCents! > 0n)
    .map((detail) => ({ index: detail.index, weight: detail.incomeCents! }));
  const centsByIndex = allocateByWeight(totalCents, weighted, totalIncome);
  const percentageByIndex = allocateByWeight(FULL_PERCENTAGE, weighted, totalIncome);

  return {
    success: true,
    splits: parsed.map((detail) => ({
      memberId: detail.memberId,
      cents: centsByIndex.get(detail.index) ?? 0n,
      percentage: percentageUnitsToDecimal(percentageByIndex.get(detail.index) ?? 0n),
    })),
  };
}

export function buildTransactionSplits({
  method,
  totalCents,
  memberIds,
  responsibleMemberId,
  details,
}: BuildTransactionSplitsInput): BuildTransactionSplitsResult {
  if (totalCents <= 0n) {
    return { success: false, message: "O valor da movimentação deve ser maior que zero." };
  }
  if (memberIds.length === 0) {
    return { success: false, message: "O espaço precisa ter ao menos um membro ativo." };
  }

  switch (method) {
    case "INDIVIDUAL":
      if (!responsibleMemberId || !memberIds.includes(responsibleMemberId)) {
        return { success: false, message: "Selecione uma pessoa responsável válida." };
      }
      return {
        success: true,
        splits: [{ memberId: responsibleMemberId, cents: totalCents }],
      };
    case "EQUAL": {
      const splits = splitEqually(totalCents, memberIds);
      if (splits.some((split) => split.cents === 0n)) {
        return {
          success: false,
          message: "O valor precisa ter ao menos R$ 0,01 por pessoa na divisão igual.",
        };
      }
      return { success: true, splits };
    }
    case "PERCENTAGE":
    case "CUSTOM":
    case "INCOME_BASED":
      if (!validateDetailMembers(details, memberIds)) {
        return {
          success: false,
          message: "A divisão deve incluir cada membro ativo uma única vez.",
        };
      }
      if (method === "PERCENTAGE") return buildPercentageSplits(totalCents, details);
      if (method === "CUSTOM") return buildCustomSplits(totalCents, details);
      return buildIncomeBasedSplits(totalCents, details);
    default: {
      const unsupportedMethod: never = method;
      throw new Error(`Método de divisão não suportado: ${unsupportedMethod}`);
    }
  }
}
