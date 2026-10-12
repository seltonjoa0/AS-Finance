"use client";

import { CircleAlert, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createTransactionAction } from "@/features/finance/actions";
import {
  isCivilDate,
  isMembershipValidOnCivilDate,
} from "@/features/finance/dates";
import {
  resolveIncomeDetails,
  type IncomeHistoryEntry,
} from "@/features/finance/incomes";
import { formatCents, parseMoneyToCents } from "@/features/finance/money";
import {
  buildTransactionSplits,
  equalPercentageInputs,
  formatPercentageInput,
  parsePercentageUnits,
  type SupportedSplitMethod,
} from "@/features/finance/splits";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type TransactionFormProps = {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>;
  members: Array<{
    id: string;
    name: string;
    joinedAt: string;
    revokedAt: string | null;
  }>;
  incomeHistory: IncomeHistoryEntry[];
  canManageIncome: boolean;
  today: string;
  initialType: "INCOME" | "EXPENSE";
};

export function TransactionForm({
  accounts,
  categories,
  members,
  incomeHistory,
  canManageIncome,
  today,
  initialType,
}: TransactionFormProps) {
  const activeMembers = members.filter((member) => member.revokedAt === null);
  const [state, action, pending] = useActionState(createTransactionAction, INITIAL_FORM_STATE);
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initialType);
  const [status, setStatus] = useState<"PENDING" | "PAID">("PAID");
  const [amount, setAmount] = useState("");
  const [competenceDate, setCompetenceDate] = useState(today);
  const [splitMethod, setSplitMethod] = useState<SupportedSplitMethod>("INDIVIDUAL");
  const [percentageValues, setPercentageValues] = useState<Record<string, string>>(() =>
    equalPercentageInputs(activeMembers.map((member) => member.id)),
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(activeMembers.map((member) => [member.id, ""])),
  );
  const matchingCategories = categories.filter((category) => category.type === type);
  const competenceDateIsValid = isCivilDate(competenceDate);
  const incomeMembers = members.filter((member) =>
    isMembershipValidOnCivilDate(member, competenceDate),
  );
  const applicableMembers =
    splitMethod === "INCOME_BASED" ? incomeMembers : activeMembers;
  const memberIds = applicableMembers.map((member) => member.id);
  const resolvedIncome = resolveIncomeDetails({
    memberIds,
    history: incomeHistory,
    competenceDate,
  });
  const missingIncomeMembers = incomeMembers.filter((member) =>
    resolvedIncome.missingMemberIds.includes(member.id),
  );
  const parsedIncomeValues = resolvedIncome.details.map((detail) =>
    parseMoneyToCents(detail.value),
  );
  const incomeTotal =
    parsedIncomeValues.every((value) => value !== null)
      ? parsedIncomeValues.reduce((sum, value) => sum + value!, 0n)
      : null;

  const parsedPercentages = applicableMembers.map((member) => parsePercentageUnits(percentageValues[member.id] ?? ""));
  const percentageTotal = parsedPercentages.every((value) => value !== null)
    ? parsedPercentages.reduce((sum, value) => sum + value!, 0n)
    : null;
  const fullPercentage = parsePercentageUnits("100")!;

  const parsedAmount = parseMoneyToCents(amount);
  const parsedCustomValues = applicableMembers.map((member) => parseMoneyToCents(customValues[member.id] ?? ""));
  const customTotal = parsedCustomValues.every((value) => value !== null)
    ? parsedCustomValues.reduce((sum, value) => sum + value!, 0n)
    : null;
  const incomeSplitResult =
    missingIncomeMembers.length === 0 && parsedAmount !== null && parsedAmount > 0n
      ? buildTransactionSplits({
          method: "INCOME_BASED",
          totalCents: parsedAmount,
          memberIds,
          details: resolvedIncome.details,
        })
      : null;
  const incomeSplits =
    incomeSplitResult?.success === true ? incomeSplitResult.splits : [];
  const splitDetails = applicableMembers.map((member) => ({
    memberId: member.id,
    value:
      splitMethod === "PERCENTAGE"
        ? (percentageValues[member.id] ?? "")
        : splitMethod === "CUSTOM"
          ? (customValues[member.id] ?? "")
          : splitMethod === "INCOME_BASED"
            ? (resolvedIncome.details.find((detail) => detail.memberId === member.id)?.value ?? "")
            : "",
  }));

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
          value={competenceDate}
          onChange={(event) => setCompetenceDate(event.target.value)}
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
          key={`payer-${memberIds.join("-")}`}
          label={status === "PAID" ? "Quem pagou" : "Quem deverá pagar"}
          name="payerMemberId"
          defaultValue={applicableMembers[0]?.id}
          error={state.fieldErrors?.payerMemberId?.[0]}
        >
          <option value="">Ainda não definido</option>
          {applicableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
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
          {type === "EXPENSE" && <option value="INCOME_BASED">Proporcional à renda</option>}
        </SelectField>
        {splitMethod === "INDIVIDUAL" && (
          <SelectField
            label="Pessoa responsável"
            name="responsibleMemberId"
            defaultValue={applicableMembers[0]?.id}
            error={state.fieldErrors?.responsibleMemberId?.[0]}
            required
          >
            {applicableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </SelectField>
        )}
      </div>

      <input type="hidden" name="splitDetails" value={JSON.stringify(splitDetails)} />

      {splitMethod === "EQUAL" && (
        <div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
            O valor será dividido entre {applicableMembers.length} {applicableMembers.length === 1 ? "pessoa" : "pessoas"}. Se houver centavos restantes, eles serão distribuídos sem alterar o total.
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </div>
      )}

      {splitMethod === "INCOME_BASED" && (
        <fieldset
          className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5"
          aria-describedby={[
            "income-split-description",
            state.fieldErrors?.splitDetails?.[0] ? "income-split-error" : null,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <legend className="px-1 text-sm font-bold text-ink">
            Prévia proporcional à renda
          </legend>
          <p id="income-split-description" className="mt-1 text-xs leading-5 text-muted">
            O servidor recalculará o rateio usando a renda vigente na data de competência.
          </p>

          <div className="mt-4">
            {!competenceDateIsValid ? (
              <div
                className="rounded-xl bg-canvas px-3 py-3 text-xs font-semibold text-muted"
                role="status"
              >
                Informe uma data de competência válida para consultar as rendas.
              </div>
            ) : incomeMembers.length === 0 ? (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                role="status"
              >
                Nenhum membro participava do espaço nessa data de competência.
              </div>
            ) : missingIncomeMembers.length > 0 ? (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
                role="status"
              >
                <div className="flex gap-3">
                  <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold">Falta renda vigente</p>
                    <p className="mt-1 text-xs leading-5">
                      {canManageIncome ? "Configure" : "Peça ao proprietário para configurar"}{" "}
                      {missingIncomeMembers.map((member) => member.name).join(", ")}{" "}
                      para usar esta data de competência.
                    </p>
                    <Link
                      href="/app/configuracoes#rendas"
                      className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-xs font-bold text-amber-900 shadow-sm"
                    >
                      {canManageIncome ? "Configurar rendas" : "Ver rendas"}
                    </Link>
                  </div>
                </div>
              </div>
            ) : incomeTotal === null || incomeTotal === 0n ? (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                role="status"
              >
                A renda total vigente precisa ser maior que zero. {canManageIncome
                  ? "Crie uma nova vigência."
                  : "Peça ao proprietário para criar uma nova vigência."}{" "}
                <Link href="/app/configuracoes#rendas" className="font-bold underline">
                  {canManageIncome ? "Configurar rendas" : "Ver rendas"}
                </Link>
              </div>
            ) : parsedAmount === null || parsedAmount <= 0n ? (
              <div
                className="rounded-xl bg-canvas px-3 py-3 text-xs font-semibold text-muted"
                role="status"
              >
                Informe o valor da movimentação para visualizar o rateio.
              </div>
            ) : incomeSplitResult?.success === false ? (
              <div
                className="rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-700"
                role="alert"
              >
                {incomeSplitResult.message}
              </div>
            ) : (
              <div>
                <ul className="space-y-2">
                  {applicableMembers.map((member) => {
                    const split = incomeSplits.find(
                      (item) => item.memberId === member.id,
                    );
                    const percentageUnits = split?.percentage
                      ? parsePercentageUnits(split.percentage)
                      : 0n;
                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-1 rounded-xl border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="truncate text-sm font-semibold text-ink">
                          {member.name}
                        </span>
                        <span className="text-sm font-bold text-ink">
                          {formatPercentageInput(percentageUnits ?? 0n)}% ·{" "}
                          {formatCents(split?.cents ?? 0n)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div
                  className="mt-3 flex items-center justify-between rounded-xl bg-brand-100 px-3 py-2 text-xs font-bold text-brand-900"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span>Total distribuído</span>
                  <span>{formatCents(parsedAmount)}</span>
                </div>
              </div>
            )}
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p id="income-split-error" className="mt-3 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </fieldset>
      )}

      {(splitMethod === "PERCENTAGE" || splitMethod === "CUSTOM") && (
        <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-ink">
            {splitMethod === "PERCENTAGE" ? "Percentual por pessoa" : "Valor por pessoa"}
          </legend>
          <div className="mt-1 space-y-3">
            {applicableMembers.map((member) => {
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
        disabled={
          pending ||
          (splitMethod === "INCOME_BASED" &&
            (!competenceDateIsValid ||
              incomeMembers.length === 0 ||
              missingIncomeMembers.length > 0 ||
              incomeTotal === null ||
              incomeTotal === 0n))
        }
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {pending ? "Salvando…" : "Salvar movimentação"}
      </button>
    </form>
  );
}
