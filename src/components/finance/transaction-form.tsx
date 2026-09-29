"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createTransactionAction } from "@/features/finance/actions";
import { formatCents, parseMoneyToCents } from "@/features/finance/money";
import {
  equalPercentageInputs,
  formatPercentageInput,
  parsePercentageUnits,
  type SupportedSplitMethod,
} from "@/features/finance/splits";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type TransactionFormProps = {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>;
  members: Array<{ id: string; name: string }>;
  today: string;
  initialType: "INCOME" | "EXPENSE";
};

export function TransactionForm({ accounts, categories, members, today, initialType }: TransactionFormProps) {
  const [state, action, pending] = useActionState(createTransactionAction, INITIAL_FORM_STATE);
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initialType);
  const [status, setStatus] = useState<"PENDING" | "PAID">("PAID");
  const [amount, setAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<SupportedSplitMethod>("INDIVIDUAL");
  const [percentageValues, setPercentageValues] = useState<Record<string, string>>(() =>
    equalPercentageInputs(members.map((member) => member.id)),
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((member) => [member.id, ""])),
  );
  const matchingCategories = categories.filter((category) => category.type === type);
  const splitDetails = members.map((member) => ({
    memberId: member.id,
    value:
      splitMethod === "PERCENTAGE"
        ? (percentageValues[member.id] ?? "")
        : splitMethod === "CUSTOM"
          ? (customValues[member.id] ?? "")
          : "",
  }));

  const parsedPercentages = members.map((member) => parsePercentageUnits(percentageValues[member.id] ?? ""));
  const percentageTotal = parsedPercentages.every((value) => value !== null)
    ? parsedPercentages.reduce((sum, value) => sum + value!, 0n)
    : null;
  const fullPercentage = parsePercentageUnits("100")!;

  const parsedAmount = parseMoneyToCents(amount);
  const parsedCustomValues = members.map((member) => parseMoneyToCents(customValues[member.id] ?? ""));
  const customTotal = parsedCustomValues.every((value) => value !== null)
    ? parsedCustomValues.reduce((sum, value) => sum + value!, 0n)
    : null;

  function customSummary() {
    if (parsedAmount === null || parsedAmount <= 0n) return "Informe o valor da movimentação para conferir a divisão.";
    if (customTotal === null) return "Preencha todos os valores da divisão.";
    if (customTotal === parsedAmount) return "Divisão completa: os valores fecham com a movimentação.";

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
          label="Situação"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "PENDING" | "PAID")}
          error={state.fieldErrors?.status?.[0]}
        >
          <option value="PAID">{type === "EXPENSE" ? "Paga" : "Recebida"}</option>
          <option value="PENDING">{type === "EXPENSE" ? "Pendente" : "A receber"}</option>
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <FormField
          label="Descrição"
          name="description"
          placeholder={type === "EXPENSE" ? "Ex.: Mercado da semana" : "Ex.: Salário"}
          error={state.fieldErrors?.description?.[0]}
          maxLength={160}
          required
        />
        <FormField
          label="Valor"
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
        <SelectField label="Conta" name="accountId" error={state.fieldErrors?.accountId?.[0]} required>
          <option value="">Selecione</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </SelectField>
        <SelectField label="Categoria" name="categoryId" error={state.fieldErrors?.categoryId?.[0]} required>
          <option value="">Selecione</option>
          {matchingCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Data de competência"
          name="competenceDate"
          type="date"
          defaultValue={today}
          error={state.fieldErrors?.competenceDate?.[0]}
          required
        />
        <FormField
          label="Vencimento (opcional)"
          name="dueDate"
          type="date"
          error={state.fieldErrors?.dueDate?.[0]}
        />
      </div>

      {type === "EXPENSE" && (
        <SelectField
          label={status === "PAID" ? "Quem pagou" : "Quem deverá pagar"}
          name="payerMemberId"
          defaultValue={members[0]?.id}
          error={state.fieldErrors?.payerMemberId?.[0]}
        >
          <option value="">Ainda não definido</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </SelectField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={type === "EXPENSE" ? "Responsabilidade" : "Receita de"}
          name="splitMethod"
          value={splitMethod}
          onChange={(event) => setSplitMethod(event.target.value as SupportedSplitMethod)}
          error={state.fieldErrors?.splitMethod?.[0]}
        >
          <option value="INDIVIDUAL">Individual</option>
          {type === "EXPENSE" && <option value="EQUAL">Dividir igualmente</option>}
          {type === "EXPENSE" && <option value="PERCENTAGE">Dividir por percentual</option>}
          {type === "EXPENSE" && <option value="CUSTOM">Definir valores por pessoa</option>}
        </SelectField>
        {splitMethod === "INDIVIDUAL" && (
          <SelectField
            label="Pessoa responsável"
            name="responsibleMemberId"
            defaultValue={members[0]?.id}
            error={state.fieldErrors?.responsibleMemberId?.[0]}
            required
          >
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </SelectField>
        )}
      </div>

      <input type="hidden" name="splitDetails" value={JSON.stringify(splitDetails)} />

      {splitMethod === "EQUAL" && (
        <div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
            O valor será dividido entre {members.length} {members.length === 1 ? "pessoa" : "pessoas"}. Se houver centavos restantes, eles serão distribuídos sem alterar o total.
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
            {splitMethod === "PERCENTAGE" ? "Percentual por pessoa" : "Valor por pessoa"}
          </legend>
          <div className="mt-1 space-y-3">
            {members.map((member) => {
              const inputId = `split-${splitMethod.toLowerCase()}-${member.id}`;
              const isPercentage = splitMethod === "PERCENTAGE";
              return (
                <div key={member.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                  <label htmlFor={inputId} className="truncate text-sm font-semibold text-ink">
                    {member.name}
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-line bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                    {!isPercentage && <span className="mr-2 text-sm font-semibold text-muted">R$</span>}
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={isPercentage ? (percentageValues[member.id] ?? "") : (customValues[member.id] ?? "")}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isPercentage) {
                          setPercentageValues((current) => ({ ...current, [member.id]: value }));
                        } else {
                          setCustomValues((current) => ({ ...current, [member.id]: value }));
                        }
                      }}
                      aria-label={`${isPercentage ? "Percentual" : "Valor"} de ${member.name}`}
                      className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-ink outline-none placeholder:text-[#a3aaa5]"
                      placeholder={isPercentage ? "0" : "0,00"}
                    />
                    {isPercentage && <span className="ml-2 text-sm font-semibold text-muted">%</span>}
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
        <label htmlFor="notes" className="block text-sm font-semibold text-ink">Observações (opcional)</label>
        <textarea
          id="notes"
          name="notes"
          maxLength={500}
          rows={3}
          className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-[#a3aaa5] hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          placeholder="Algum detalhe importante?"
        />
      </div>

      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {pending ? "Salvando…" : "Salvar movimentação"}
      </button>
    </form>
  );
}
