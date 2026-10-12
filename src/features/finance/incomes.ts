import { isCivilDate } from "@/features/finance/dates";

export type IncomeDetail = {
  memberId: string;
  value: string;
};

export type IncomeHistoryEntry = {
  memberId: string;
  amount: string;
  effectiveFrom: string;
};

export function parseIncomeDetails(value: string): IncomeDetail[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 100) return null;

    const details: IncomeDetail[] = [];
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

      details.push({ memberId: record.memberId, value: record.value });
    }

    return details;
  } catch {
    return null;
  }
}

export function resolveIncomeDetails({
  memberIds,
  history,
  competenceDate,
}: {
  memberIds: string[];
  history: IncomeHistoryEntry[];
  competenceDate: string;
}) {
  const latestByMember = new Map<string, IncomeHistoryEntry>();

  if (isCivilDate(competenceDate)) {
    for (const entry of history) {
      if (
        !memberIds.includes(entry.memberId) ||
        !isCivilDate(entry.effectiveFrom) ||
        entry.effectiveFrom > competenceDate
      ) {
        continue;
      }

      const current = latestByMember.get(entry.memberId);
      if (!current || entry.effectiveFrom > current.effectiveFrom) {
        latestByMember.set(entry.memberId, entry);
      }
    }
  }

  const details: IncomeDetail[] = [];
  const missingMemberIds: string[] = [];

  for (const memberId of memberIds) {
    const entry = latestByMember.get(memberId);
    if (entry) {
      details.push({ memberId, value: entry.amount });
    } else {
      missingMemberIds.push(memberId);
    }
  }

  return { details, missingMemberIds };
}
