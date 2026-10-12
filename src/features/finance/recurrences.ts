import { isCivilDate } from "@/features/finance/dates";

export type RecurrenceFrequency = "MONTHLY";

export type RecurringRuleState = "ACTIVE" | "PAUSED" | "ENDED";

export type MonthlyRecurrenceRule = {
  frequency: "MONTHLY";
  state: RecurringRuleState;
  startDate: string;
  endDate: string | null;
  dayOfMonth: number;
};

export type MonthlyRecurrenceRuleInput = {
  frequency?: "MONTHLY";
  state?: RecurringRuleState;
  startDate: string;
  endDate?: string | null;
  dayOfMonth?: number;
};

type CivilDateParts = {
  year: number;
  month: number;
  day: number;
};

function parseCivilDate(value: string, fieldName: string): CivilDateParts {
  if (!isCivilDate(value)) {
    throw new Error(`${fieldName} deve ser uma data civil válida.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function formatCivilDate({ year, month, day }: CivilDateParts) {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function addMonths(year: number, month: number, amount: number) {
  const absoluteMonth = year * 12 + (month - 1) + amount;
  return {
    year: Math.floor(absoluteMonth / 12),
    month: (absoluteMonth % 12) + 1,
  };
}

function monthDistance(from: CivilDateParts, to: CivilDateParts) {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/**
 * Normaliza uma regra mensal. O dia-base nasce da data inicial e nunca de uma
 * ocorrência ajustada para um mês curto.
 */
export function createMonthlyRecurrenceRule(
  input: MonthlyRecurrenceRuleInput,
): MonthlyRecurrenceRule {
  if (input.frequency !== undefined && input.frequency !== "MONTHLY") {
    throw new Error("A frequência da recorrência deve ser mensal.");
  }

  const start = parseCivilDate(input.startDate, "A data inicial");
  const endDate = input.endDate ?? null;

  if (endDate !== null) {
    parseCivilDate(endDate, "A data final");
    if (endDate < input.startDate) {
      throw new Error("A data final não pode ser anterior à data inicial.");
    }
  }

  const dayOfMonth = input.dayOfMonth ?? start.day;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("O dia-base deve ser um inteiro entre 1 e 31.");
  }
  if (dayOfMonth !== start.day) {
    throw new Error("O dia-base deve ser derivado da data inicial.");
  }

  const state = input.state ?? "ACTIVE";
  if (state !== "ACTIVE" && state !== "PAUSED" && state !== "ENDED") {
    throw new Error("O estado da recorrência é inválido.");
  }

  return {
    frequency: "MONTHLY",
    state,
    startDate: input.startDate,
    endDate,
    dayOfMonth,
  };
}

/**
 * Retorna a competência pelo índice, começando em zero. O cálculo sempre parte
 * do dia-base original para que fevereiro não desloque as competências futuras.
 */
export function recurrenceCompetenceAt(
  ruleInput: MonthlyRecurrenceRuleInput,
  occurrenceIndex: number,
): string | null {
  if (!Number.isSafeInteger(occurrenceIndex) || occurrenceIndex < 0) {
    throw new Error("O índice da ocorrência deve ser um inteiro não negativo.");
  }

  const rule = createMonthlyRecurrenceRule(ruleInput);
  const start = parseCivilDate(rule.startDate, "A data inicial");
  const targetMonth = addMonths(start.year, start.month, occurrenceIndex);
  if (targetMonth.year > 9999) return null;
  const competence = formatCivilDate({
    ...targetMonth,
    day: Math.min(rule.dayOfMonth, daysInMonth(targetMonth.year, targetMonth.month)),
  });

  return rule.endDate !== null && competence > rule.endDate ? null : competence;
}

/**
 * Calcula a primeira competência estritamente posterior a `afterDate`. Quando
 * a data é omitida, retorna a competência inicial. Uma regra pausada conserva
 * sua próxima competência; somente regras encerradas deixam de tê-la.
 */
export function nextRecurrenceCompetence(
  ruleInput: MonthlyRecurrenceRuleInput,
  afterDate?: string | null,
): string | null {
  const rule = createMonthlyRecurrenceRule(ruleInput);
  if (rule.state === "ENDED") return null;
  if (afterDate === undefined || afterDate === null) {
    return recurrenceCompetenceAt(rule, 0);
  }

  const after = parseCivilDate(afterDate, "A data de referência");
  if (afterDate < rule.startDate) return recurrenceCompetenceAt(rule, 0);

  const start = parseCivilDate(rule.startDate, "A data inicial");
  let occurrenceIndex = Math.max(0, monthDistance(start, after));
  const sameMonthCandidate = recurrenceCompetenceAt(rule, occurrenceIndex);

  if (sameMonthCandidate === null) return null;
  if (sameMonthCandidate <= afterDate) occurrenceIndex += 1;

  return recurrenceCompetenceAt(rule, occurrenceIndex);
}

/**
 * Lista competências até o horizonte inclusivo. `afterDate` permite continuar
 * lotes usando um limite inferior exclusivo. A persistência deve manter a chave
 * única regra + competência para tornar a materialização idempotente.
 */
export function materializeRecurrenceCompetences({
  rule: ruleInput,
  horizonDate,
  afterDate,
}: {
  rule: MonthlyRecurrenceRuleInput;
  horizonDate: string;
  afterDate?: string | null;
}): string[] {
  const rule = createMonthlyRecurrenceRule(ruleInput);
  parseCivilDate(horizonDate, "O horizonte");

  if (afterDate !== undefined && afterDate !== null) {
    parseCivilDate(afterDate, "A data de referência");
  }
  if (rule.state !== "ACTIVE" || horizonDate < rule.startDate) return [];

  const competences: string[] = [];
  let competence = nextRecurrenceCompetence(rule, afterDate);

  while (competence !== null && competence <= horizonDate) {
    competences.push(competence);
    competence = nextRecurrenceCompetence(rule, competence);
  }

  return competences;
}
