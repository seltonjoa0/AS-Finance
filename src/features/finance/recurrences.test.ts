import { describe, expect, it } from "vitest";

import {
  createMonthlyRecurrenceRule,
  materializeRecurrenceCompetences,
  nextRecurrenceCompetence,
  recurrenceCompetenceAt,
} from "@/features/finance/recurrences";

describe("monthly recurrences", () => {
  it("deriva e preserva o dia-base da data inicial", () => {
    const rule = createMonthlyRecurrenceRule({ startDate: "2026-01-31" });

    expect(rule).toEqual({
      frequency: "MONTHLY",
      state: "ACTIVE",
      startDate: "2026-01-31",
      endDate: null,
      dayOfMonth: 31,
    });
    expect([0, 1, 2, 3].map((index) => recurrenceCompetenceAt(rule, index))).toEqual(
      ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
    );
  });

  it("não acumula o ajuste dos dias 29 e 30 em meses curtos", () => {
    const day29 = createMonthlyRecurrenceRule({ startDate: "2023-01-29" });
    const day30 = createMonthlyRecurrenceRule({ startDate: "2026-01-30" });

    expect([1, 2, 13, 14].map((index) => recurrenceCompetenceAt(day29, index))).toEqual(
      ["2023-02-28", "2023-03-29", "2024-02-29", "2024-03-29"],
    );
    expect([1, 2, 3].map((index) => recurrenceCompetenceAt(day30, index))).toEqual([
      "2026-02-28",
      "2026-03-30",
      "2026-04-30",
    ]);
  });

  it("trata corretamente anos bissextos e a virada de ano", () => {
    const rule = createMonthlyRecurrenceRule({ startDate: "2027-12-31" });

    expect([0, 1, 2, 3].map((index) => recurrenceCompetenceAt(rule, index))).toEqual(
      ["2027-12-31", "2028-01-31", "2028-02-29", "2028-03-31"],
    );
  });

  it("considera a data final inclusiva", () => {
    const inclusiveRule = createMonthlyRecurrenceRule({
      startDate: "2026-01-31",
      endDate: "2026-04-30",
    });
    const beforeOccurrenceRule = createMonthlyRecurrenceRule({
      startDate: "2026-01-31",
      endDate: "2026-03-30",
    });

    expect(materializeRecurrenceCompetences({
      rule: inclusiveRule,
      horizonDate: "2026-12-31",
    })).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(materializeRecurrenceCompetences({
      rule: beforeOccurrenceRule,
      horizonDate: "2026-12-31",
    })).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("calcula a próxima competência estritamente após a referência", () => {
    const rule = createMonthlyRecurrenceRule({ startDate: "2026-01-31" });

    expect(nextRecurrenceCompetence(rule)).toBe("2026-01-31");
    expect(nextRecurrenceCompetence(rule, "2026-01-01")).toBe("2026-01-31");
    expect(nextRecurrenceCompetence(rule, "2026-01-31")).toBe("2026-02-28");
    expect(nextRecurrenceCompetence(rule, "2026-02-27")).toBe("2026-02-28");
    expect(nextRecurrenceCompetence(rule, "2026-02-28")).toBe("2026-03-31");
  });

  it("limita a materialização pelo horizonte inclusivo e pelo início exclusivo", () => {
    const rule = createMonthlyRecurrenceRule({ startDate: "2026-01-15" });

    expect(materializeRecurrenceCompetences({
      rule,
      horizonDate: "2026-04-15",
      afterDate: "2026-02-15",
    })).toEqual(["2026-03-15", "2026-04-15"]);
    expect(materializeRecurrenceCompetences({
      rule,
      horizonDate: "2026-01-14",
    })).toEqual([]);
  });

  it("não materializa uma regra pausada, mas conserva sua próxima competência", () => {
    const rule = createMonthlyRecurrenceRule({
      startDate: "2026-01-31",
      state: "PAUSED",
    });

    expect(nextRecurrenceCompetence(rule, "2026-01-31")).toBe("2026-02-28");
    expect(materializeRecurrenceCompetences({
      rule,
      horizonDate: "2026-12-31",
    })).toEqual([]);
  });

  it("não calcula próxima competência para uma regra encerrada", () => {
    const rule = createMonthlyRecurrenceRule({
      startDate: "2026-01-31",
      state: "ENDED",
    });

    expect(nextRecurrenceCompetence(rule)).toBeNull();
    expect(materializeRecurrenceCompetences({
      rule,
      horizonDate: "2026-12-31",
    })).toEqual([]);
  });

  it("rejeita datas, índices e dias-base inválidos", () => {
    expect(() => createMonthlyRecurrenceRule({ startDate: "2026-02-30" })).toThrow(
      "data civil válida",
    );
    expect(() => createMonthlyRecurrenceRule({
      startDate: "2026-03-15",
      endDate: "2026-03-14",
    })).toThrow("anterior");
    expect(() => createMonthlyRecurrenceRule({
      startDate: "2026-03-15",
      dayOfMonth: 16,
    })).toThrow("derivado");
    expect(() => recurrenceCompetenceAt({ startDate: "2026-03-15" }, -1)).toThrow(
      "não negativo",
    );
  });
});
