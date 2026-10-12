"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { createIncomeSettingsAction } from "@/features/finance/actions";
import { formatCents, parseMoneyToCents } from "@/features/finance/money";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type IncomeSettingsFormProps = {
  members: Array<{ id: string; name: string; currentIncome: string | null }>;
  today: string;
};

export function IncomeSettingsForm({ members, today }: IncomeSettingsFormProps) {
  const [state, action, pending] = useActionState(
    createIncomeSettingsAction,
    INITIAL_FORM_STATE,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((member) => [member.id, member.currentIncome ?? ""]),
    ),
  );
  const details = members.map((member) => ({
    memberId: member.id,
    value: values[member.id] ?? "",
  }));
  const parsedValues = details.map((detail) => parseMoneyToCents(detail.value));
  const total =
    parsedValues.every((value) => value !== null)
      ? parsedValues.reduce((sum, value) => sum + value!, 0n)
      : null;
  const detailsError = state.fieldErrors?.incomeDetails?.[0];

  return (
    <form action={action} className="space-y-5" noValidate aria-busy={pending}>
      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
        Esta é a renda mensal de referência para calcular despesas proporcionais.
        Ela não cria uma receita e não altera os saldos das contas.
      </div>

      <FormField
        label="Início da vigência"
        name="effectiveFrom"
        type="date"
        defaultValue={today}
        error={state.fieldErrors?.effectiveFrom?.[0]}
        hint="A configuração será usada nas movimentações com competência a partir desta data."
        required
      />

      <fieldset
        className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5"
        aria-describedby={[
          "income-details-hint",
          detailsError ? "income-details-error" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <legend className="px-1 text-sm font-bold text-ink">
          Renda por membro
        </legend>
        <p id="income-details-hint" className="mt-1 text-xs leading-5 text-muted">
          Preencha todos os membros. Use R$ 0,00 para quem não possui renda.
        </p>
        <div className="mt-4 space-y-4">
          {members.map((member) => (
            <FormField
              key={member.id}
              id={`income-${member.id}`}
              label={member.name}
              inputMode="decimal"
              placeholder="0,00"
              value={values[member.id] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [member.id]: event.target.value,
                }))
              }
              required
            />
          ))}
        </div>
        <div
          className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold leading-5 ${
            total !== null && total > 0n
              ? "bg-brand-100 text-brand-800"
              : "bg-amber-50 text-amber-800"
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {total === null
            ? "Revise os valores informados."
            : total === 0n
              ? "A renda total precisa ser maior que zero."
              : `Renda total de referência: ${formatCents(total)}.`}
        </div>
        {detailsError && (
          <p id="income-details-error" className="mt-3 text-sm text-red-600" role="alert">
            {detailsError}
          </p>
        )}
      </fieldset>

      <input type="hidden" name="incomeDetails" value={JSON.stringify(details)} />
      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {pending ? "Salvando…" : "Salvar nova vigência"}
      </button>
    </form>
  );
}
