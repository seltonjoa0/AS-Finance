"use client";

import { CircleAlert, LoaderCircle, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createCreditCardPurchaseAction } from "@/features/finance/credit-card-actions";
import { isMembershipValidOnCivilDate } from "@/features/finance/dates";
import {
  resolveIncomeDetails,
  type IncomeHistoryEntry,
} from "@/features/finance/incomes";
import { formatCents, parseMoneyToCents } from "@/features/finance/money";
import {
  equalPercentageInputs,
  formatPercentageInput,
  parsePercentageUnits,
  type SupportedSplitMethod,
} from "@/features/finance/splits";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type CreditCardPurchaseFormProps = {
  cards: Array<{ id: string; name: string; bank: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
  }>;
  members: Array<{
    id: string;
    name: string;
    joinedAt: string;
    revokedAt: string | null;
  }>;
  incomeHistory: IncomeHistoryEntry[];
  today: string;
};

export function CreditCardPurchaseForm({
  cards,
  categories,
  members,
  incomeHistory,
  today,
}: CreditCardPurchaseFormProps) {
  const activeMembers = members.filter((member) => member.revokedAt === null);
  const [state, action, pending] = useActionState(
    createCreditCardPurchaseAction,
    INITIAL_FORM_STATE,
  );
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [splitMethod, setSplitMethod] =
    useState<SupportedSplitMethod>("INDIVIDUAL");
  const [percentageValues, setPercentageValues] = useState<
    Record<string, string>
  >(() => equalPercentageInputs(activeMembers.map((member) => member.id)));
  const [customValues, setCustomValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(activeMembers.map((member) => [member.id, ""])),
  );

  const incomeMembers = members.filter((member) =>
    isMembershipValidOnCivilDate(member, purchaseDate),
  );
  const applicableMembers =
    splitMethod === "INCOME_BASED" ? incomeMembers : activeMembers;
  const resolvedIncome = resolveIncomeDetails({
    memberIds: applicableMembers.map((member) => member.id),
    history: incomeHistory,
    competenceDate: purchaseDate,
  });
  const missingIncomeMembers = applicableMembers.filter((member) =>
    resolvedIncome.missingMemberIds.includes(member.id),
  );
  const parsedAmount = parseMoneyToCents(amount);
  const parsedPercentages = applicableMembers.map((member) =>
    parsePercentageUnits(percentageValues[member.id] ?? ""),
  );
  const percentageTotal = parsedPercentages.every((value) => value !== null)
    ? parsedPercentages.reduce((sum, value) => sum + value!, 0n)
    : null;
  const fullPercentage = parsePercentageUnits("100")!;
  const parsedCustomValues = applicableMembers.map((member) =>
    parseMoneyToCents(customValues[member.id] ?? ""),
  );
  const customTotal = parsedCustomValues.every((value) => value !== null)
    ? parsedCustomValues.reduce((sum, value) => sum + value!, 0n)
    : null;
  const splitDetails = applicableMembers.map((member) => ({
    memberId: member.id,
    value:
      splitMethod === "PERCENTAGE"
        ? (percentageValues[member.id] ?? "")
        : splitMethod === "CUSTOM"
          ? (customValues[member.id] ?? "")
          : splitMethod === "INCOME_BASED"
            ? (resolvedIncome.details.find(
                (detail) => detail.memberId === member.id,
              )?.value ?? "")
            : "",
  }));

  function customSummary() {
    if (parsedAmount === null || parsedAmount <= 0n) {
      return "Informe o valor da compra para conferir a divisão.";
    }
    if (customTotal === null) return "Preencha todos os valores da divisão.";
    if (customTotal === parsedAmount) {
      return "Divisão completa: os valores fecham com a compra.";
    }

    const difference = parsedAmount - customTotal;
    return difference > 0n
      ? "Ainda faltam " + formatCents(difference) + "."
      : "A divisão excede o total em " + formatCents(-difference) + ".";
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Cartão"
          name="cardId"
          defaultValue=""
          error={state.fieldErrors?.cardId?.[0]}
          required
        >
          <option value="">Selecione</option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name} · {card.bank}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Categoria"
          name="categoryId"
          defaultValue=""
          error={state.fieldErrors?.categoryId?.[0]}
          required
        >
          <option value="">Selecione</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <FormField
          label="Descrição"
          name="description"
          placeholder="Ex.: Mercado da semana"
          maxLength={160}
          error={state.fieldErrors?.description?.[0]}
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
        <FormField
          label="Data da compra"
          name="purchaseDate"
          type="date"
          value={purchaseDate}
          max={today}
          onChange={(event) => setPurchaseDate(event.target.value)}
          error={state.fieldErrors?.purchaseDate?.[0]}
          required
        />
        <SelectField
          key={"payer-" + applicableMembers.map((member) => member.id).join("-")}
          label="Quem fez a compra (opcional)"
          name="payerMemberId"
          defaultValue=""
          hint="Ajuda a identificar quem utilizou o cartão."
          error={state.fieldErrors?.payerMemberId?.[0]}
        >
          <option value="">Usar o titular do cartão</option>
          {applicableMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Responsabilidade"
          name="splitMethod"
          value={splitMethod}
          onChange={(event) =>
            setSplitMethod(event.target.value as SupportedSplitMethod)
          }
          error={state.fieldErrors?.splitMethod?.[0]}
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="EQUAL">Dividir igualmente</option>
          <option value="PERCENTAGE">Dividir por percentual</option>
          <option value="CUSTOM">Definir valores por pessoa</option>
          <option value="INCOME_BASED">Proporcional à renda</option>
        </SelectField>
        {splitMethod === "INDIVIDUAL" && (
          <SelectField
            key={applicableMembers.map((member) => member.id).join("-")}
            label="Pessoa responsável"
            name="responsibleMemberId"
            defaultValue={applicableMembers[0]?.id ?? ""}
            error={state.fieldErrors?.responsibleMemberId?.[0]}
            required
          >
            <option value="">Selecione</option>
            {applicableMembers.map((member) => (
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
            O valor será dividido entre {applicableMembers.length}{" "}
            {applicableMembers.length === 1 ? "pessoa" : "pessoas"}, preservando o total
            exato em centavos.
          </div>
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </div>
      )}

      {splitMethod === "INCOME_BASED" && (
        <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-ink">
            Divisão proporcional à renda
          </legend>
          <p className="mt-1 text-xs leading-5 text-muted">
            A renda vigente na data da compra será validada novamente pelo
            servidor.
          </p>
          {missingIncomeMembers.length > 0 ? (
            <div
              className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
              role="status"
            >
              <CircleAlert
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold">Falta renda vigente</p>
                <p className="mt-1 text-xs leading-5">
                  Configure a renda de{" "}
                  {missingIncomeMembers.map((member) => member.name).join(", ")}{" "}
                  para esta data.
                </p>
                <Link
                  href="/app/configuracoes#rendas"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-xs font-bold text-amber-900 shadow-sm"
                >
                  Configurar rendas
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {applicableMembers.map((member) => {
                const income = resolvedIncome.details.find(
                  (detail) => detail.memberId === member.id,
                );
                const incomeCents = income
                  ? parseMoneyToCents(income.value)
                  : null;
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-3"
                  >
                    <span className="truncate text-sm font-semibold text-ink">
                      {member.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink">
                      {formatCents(incomeCents ?? 0n)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {state.fieldErrors?.splitDetails?.[0] && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {state.fieldErrors.splitDetails[0]}
            </p>
          )}
        </fieldset>
      )}

      {(splitMethod === "PERCENTAGE" || splitMethod === "CUSTOM") && (
        <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-ink">
            {splitMethod === "PERCENTAGE"
              ? "Percentual por pessoa"
              : "Valor por pessoa"}
          </legend>
          <div className="mt-2 space-y-3">
            {applicableMembers.map((member) => {
              const isPercentage = splitMethod === "PERCENTAGE";
              const inputId =
                "card-split-" +
                splitMethod.toLowerCase() +
                "-" +
                member.id;
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
                      aria-label={
                        (isPercentage ? "Percentual" : "Valor") +
                        " de " +
                        member.name
                      }
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
            className={
              "mt-4 rounded-xl px-3 py-2 text-xs font-semibold leading-5 " +
              (splitMethod === "PERCENTAGE"
                ? percentageTotal === fullPercentage
                  ? "bg-brand-100 text-brand-800"
                  : "bg-amber-50 text-amber-800"
                : parsedAmount !== null && customTotal === parsedAmount
                  ? "bg-brand-100 text-brand-800"
                  : "bg-amber-50 text-amber-800")
            }
            aria-live="polite"
          >
            {splitMethod === "PERCENTAGE"
              ? percentageTotal === null
                ? "Revise os percentuais informados."
                : formatPercentageInput(percentageTotal) +
                  "% de 100% distribuídos."
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
          htmlFor="card-purchase-notes"
          className="block text-sm font-semibold text-ink"
        >
          Observações (opcional)
        </label>
        <textarea
          id="card-purchase-notes"
          name="notes"
          rows={3}
          maxLength={500}
          aria-invalid={Boolean(state.fieldErrors?.notes?.[0])}
          className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-[#a3aaa5] hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          placeholder="Algum detalhe importante?"
        />
        {state.fieldErrors?.notes?.[0] && (
          <p className="text-sm text-red-600" role="alert">
            {state.fieldErrors.notes[0]}
          </p>
        )}
      </div>

      <FormAlert state={state} />
      <button
        type="submit"
        disabled={
          pending ||
          cards.length === 0 ||
          categories.length === 0 ||
          applicableMembers.length === 0 ||
          (splitMethod === "INCOME_BASED" &&
            missingIncomeMembers.length > 0)
        }
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ShoppingCart className="size-4" aria-hidden="true" />
        )}
        {pending ? "Salvando…" : "Registrar compra"}
      </button>
    </form>
  );
}
