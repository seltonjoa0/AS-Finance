"use client";

import { CreditCard, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createCreditCardAction } from "@/features/finance/credit-card-actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type CreditCardFormProps = {
  members: Array<{ id: string; name: string }>;
};

export function CreditCardForm({ members }: CreditCardFormProps) {
  const [state, action, pending] = useActionState(
    createCreditCardAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Nome do cartão"
          name="name"
          placeholder="Ex.: Visa principal"
          maxLength={100}
          autoComplete="off"
          error={state.fieldErrors?.name?.[0]}
          required
        />
        <FormField
          label="Banco ou emissor"
          name="bank"
          placeholder="Ex.: Nubank"
          maxLength={100}
          autoComplete="organization"
          error={state.fieldErrors?.bank?.[0]}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Titular"
          name="holderMemberId"
          defaultValue={members[0]?.id ?? ""}
          error={state.fieldErrors?.holderMemberId?.[0]}
          required
        >
          <option value="">Selecione</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </SelectField>
        <FormField
          label="Limite total"
          name="creditLimit"
          placeholder="0,00"
          inputMode="decimal"
          autoComplete="off"
          error={state.fieldErrors?.creditLimit?.[0]}
          required
        />
      </div>

      <fieldset className="rounded-[20px] border border-line bg-[#fbfcfb] p-4">
        <legend className="px-1 text-sm font-bold text-ink">
          Ciclo da fatura
        </legend>
        <p className="mt-1 text-xs leading-5 text-muted">
          Em meses mais curtos, será usado o último dia disponível.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Dia de fechamento"
            name="closingDay"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="25"
            error={state.fieldErrors?.closingDay?.[0]}
            required
          />
          <FormField
            label="Dia de vencimento"
            name="dueDay"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="5"
            error={state.fieldErrors?.dueDay?.[0]}
            required
          />
        </div>
      </fieldset>

      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending || members.length === 0}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        {pending ? "Salvando…" : "Cadastrar cartão"}
      </button>
    </form>
  );
}
