"use client";

import { LoaderCircle, Repeat2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createRecurringRuleAction } from "@/features/finance/recurrence-actions";
import { formatCents, parseMoneyToCents } from "@/features/finance/money";
import {
  equalPercentageInputs,
  formatPercentageInput,
  parsePercentageUnits,
  type SupportedSplitMethod,
} from "@/features/finance/splits";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type RecurringRuleFormProps = {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>;
  members: Array<{ id: string; name: string }>;
  today: string;
  initialType: "INCOME" | "EXPENSE";
};

export function RecurringRuleForm({
  accounts,
  categories,
  members,
  today,
  initialType,
}: RecurringRuleFormProps) {
  const [state, action, pending] = useActionState(
    createRecurringRuleAction,
    INITIAL_FORM_STATE,
  );
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initialType);
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [splitMethod, setSplitMethod] =
    useState<SupportedSplitMethod>("INDIVIDUAL");
  const [percentageValues, setPercentageValues] = useState<
    Record<string, string>
  >(() => equalPercentageInputs(members.map((member) => member.id)));
  const [customValues, setCustomValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((member) => [member.id, ""])),
  );

  const matchingCategories = categories.filter(
    (category) => category.type === type,
  );
  const parsedAmount = parseMoneyToCents(amount);
  const parsedPercentages = members.map((member) =>
    parsePercentageUnits(percentageValues[member.id] ?? ""),
  );
  const percentageTotal = parsedPercentages.every((value) => value !== null)
    ? parsedPercentages.reduce((sum, value) => sum + value!, 0n)
    : null;
  const fullPercentage = parsePercentageUnits("100")!;
  const parsedCustomValues = members.map((member) =>
    parseMoneyToCents(customValues[member.id] ?? ""),
  );
  const customTotal = parsedCustomValues.every((value) => value !== null)
    ? parsedCustomValues.reduce((sum, value) => sum + value!, 0n)
    : null;
  const splitDetails = members.map((member) => ({
    memberId: member.id,
    value:
      splitMethod === "PERCENTAGE"
        ? (percentageValues[member.id] ?? "")
        : splitMethod === "CUSTOM"
          ? (customValues[member.id] ?? "")
          : "",
  }));

  function customSummary() {
    if (parsedAmount === null || parsedAmount <= 0n) {
      return "Informe o valor mensal para conferir a divisão.";
    }
    if (customTotal === null) return "Preencha todos os valores da divisão.";
    if (customTotal === parsedAmount) {
      return "Divisão completa: os valores fecham com a recorrência.";
    }

    const difference = parsedAmount - customTotal;
    return difference > 0n
      ? `Ainda faltam ${formatCents(difference)}.`
      : `A divisão excede o total em ${formatCents(-difference)}.`;
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          name="type"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value as "INCOME" | "EXPENSE";
            setType(nextType);
            if (nextType === "INCOME") setSplitMethod("INDIVIDUAL");
          }}
          error={state.fieldErrors?.type?.[0]}
        >
          <option value="EXPENSE">Despesa</option>
          <option value="INCOME">Receita</option>
        </SelectField>
        <SelectField
          label="Situação das previsões"
          name="transactionStatus"
          defaultValue="PENDING"
          hint="As ocorrências serão confirmadas individualmente quando acontecerem."
          error={state.fieldErrors?.transactionStatus?.[0]}
        >
          <option value="PENDING">
            {type === "EXPENSE" ? "A pagar" : "A receber"}
          </option>
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <FormField
          label="Descrição"
          name="description"
          placeholder={type === "EXPENSE" ? "Ex.: Aluguel" : "Ex.: Salário"}
          maxLength={160}
          error={state.fieldErrors?.description?.[0]}
          required
        />
        <FormField
          label="Valor mensal"
          name="amount"
          placeholder="0,00"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={state.fieldErrors?.amount?.[0]}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Conta"
          name="accountId"
          error={state.fieldErrors?.accountId?.[0]}
          required
        >
          <option value="">Selecione</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          key={type}
          label="Categoria"
          name="categoryId"
          defaultValue=""
          error={state.fieldErrors?.categoryId?.[0]}
          required
        >
          <option value="">Selecione</option>
          {matchingCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold text-ink">
          Repetição mensal
        </legend>
        <p className="mt-1 text-xs leading-5 text-muted">
          A primeira data define o dia de repetição. Em meses mais curtos, será
          usado o último dia disponível.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Primeira competência"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            error={state.fieldErrors?.startDate?.[0]}
            required
          />
          <FormField
            label="Encerrar em (opcional)"
            name="endDate"
            type="date"
            min={startDate}
            error={state.fieldErrors?.endDate?.[0]}
          />
        </div>
      </fieldset>

      {type === "EXPENSE" && (
        <SelectField
          label="Quem deverá pagar"
          name="payerMemberId"
          defaultValue=""
          hint="O pagador pode ser definido depois em cada ocorrência."
          error={state.fieldErrors?.payerMemberId?.[0]}
        >
          <option value="">Ainda não definido</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </SelectField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={type === "EXPENSE" ? "Responsabilidade" : "Receita de"}
          name="splitMethod"
          value={splitMethod}
          onChange={(event) =>
            setSplitMethod(event.target.value as SupportedSplitMethod)
          }
          error={state.fieldErrors?.splitMethod?.[0]}
        >
          <option value="INDIVIDUAL">Individual</option>
          {type === "EXPENSE" && (
            <option value="EQUAL">Dividir igualmente</option>
          )}
          {type === "EXPENSE" && (
            <option value="PERCENTAGE">Dividir por percentual</option>
          )}
          {type === "EXPENSE" && (
            <option value="CUSTOM">Definir valores por pessoa</option>
          )}
          {type === "EXPENSE" && (
            <option value="INCOME_BASED">Proporcional à renda</option>
          )}
        </SelectField>
        {splitMethod === "INDIVIDUAL" && (
          <SelectField
            label="Pessoa responsável"
            name="responsibleMemberId"
            defaultValue={members[0]?.id}
            error={state.fieldErrors?.responsibleMemberId?.[0]}
            required
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <input
        type="hidden"
        name="splitDetails"
        value={JSON.stringify(splitDetails)}
      />

      {splitMethod === "EQUAL" && (
        <div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
            Cada ocorrência será dividida entre {members.length}{" "}
            {members.length === 1 ? "pessoa" : "pessoas"}, sempre fechando o
            valor total em centavos.
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </div>
      )}

      {splitMethod === "INCOME_BASED" && (
        <div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            A divisão será recalculada em cada mês usando a renda vigente na
            competência da ocorrência. Se faltar uma renda, a previsão não será
            criada até a configuração ser completada.
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </div>
      )}

      {(splitMethod === "PERCENTAGE" || splitMethod === "CUSTOM") && (
        <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-ink">
            {splitMethod === "PERCENTAGE"
              ? "Percentual por pessoa"
              : "Valor por pessoa"}
          </legend>
          <div className="mt-1 space-y-3">
            {members.map((member) => {
              const isPercentage = splitMethod === "PERCENTAGE";
              const inputId = `recurring-split-${splitMethod.toLowerCase()}-${member.id}`;
              return (
                <div
                  key={member.id}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center"
                >
                  <label
                    htmlFor={inputId}
                    className="truncate text-sm font-semibold text-ink"
                  >
                    {member.name}
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-line bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                    {!isPercentage && (
                      <span className="mr-2 text-sm font-semibold text-muted">
                        R$
                      </span>
                    )}
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={
                        isPercentage
                          ? (percentageValues[member.id] ?? "")
                          : (customValues[member.id] ?? "")
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isPercentage) {
                          setPercentageValues((current) => ({
                            ...current,
                            [member.id]: value,
                          }));
                        } else {
                          setCustomValues((current) => ({
                            ...current,
                            [member.id]: value,
                          }));
                        }
                      }}
                      aria-label={`${isPercentage ? "Percentual" : "Valor"} de ${member.name}`}
                      className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-ink outline-none placeholder:text-[#a3aaa5]"
                      placeholder={isPercentage ? "0" : "0,00"}
                    />
                    {isPercentage && (
                      <span className="ml-2 text-sm font-semibold text-muted">
                        %
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold leading-5 ${
              splitMethod === "PERCENTAGE"
                ? percentageTotal === fullPercentage
                  ? "bg-brand-100 text-brand-800"
                  : "bg-amber-50 text-amber-800"
                : parsedAmount !== null && customTotal === parsedAmount
                  ? "bg-brand-100 text-brand-800"
                  : "bg-amber-50 text-amber-800"
            }`}
            aria-live="polite"
          >
            {splitMethod === "PERCENTAGE"
              ? percentageTotal === null
                ? "Revise os percentuais informados."
                : `${formatPercentageInput(percentageTotal)}% de 100% distribuídos.`
              : customSummary()}
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </fieldset>
      )}

      <div className="space-y-2">
        <label
          htmlFor="recurring-notes"
          className="block text-sm font-semibold text-ink"
        >
          Observações (opcional)
        </label>
        <textarea
          id="recurring-notes"
          name="notes"
          maxLength={500}
          rows={3}
          aria-invalid={Boolean(state.fieldErrors?.notes?.[0])}
          aria-describedby={
            state.fieldErrors?.notes?.[0] ? "recurring-notes-error" : undefined
          }
          className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-[#a3aaa5] hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          placeholder="Ex.: reajuste previsto em janeiro"
        />
        {state.fieldErrors?.notes?.[0] && (
          <p
            id="recurring-notes-error"
            className="text-sm text-red-600"
            role="alert"
          >
            {state.fieldErrors.notes[0]}
          </p>
        )}
      </div>

      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Repeat2 className="size-4" aria-hidden="true" />
        )}
        {pending ? "Salvando…" : "Criar recorrência"}
      </button>
    </form>
  );
}
