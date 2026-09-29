"use client";

import { Landmark, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createAccountAction } from "@/features/finance/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function AccountForm({ members }: { members: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createAccountAction, INITIAL_FORM_STATE);
  const [ownership, setOwnership] = useState("INDIVIDUAL");

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        label="Nome da conta"
        name="name"
        placeholder="Ex.: Conta principal"
        error={state.fieldErrors?.name?.[0]}
        maxLength={100}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Tipo" name="type" defaultValue="CHECKING" error={state.fieldErrors?.type?.[0]}>
          <option value="CHECKING">Conta corrente</option>
          <option value="SAVINGS">Poupança</option>
          <option value="CASH">Dinheiro</option>
          <option value="INVESTMENT">Investimentos</option>
          <option value="OTHER">Outra</option>
        </SelectField>
        <SelectField
          label="Uso da conta"
          name="ownership"
          value={ownership}
          onChange={(event) => setOwnership(event.target.value)}
          error={state.fieldErrors?.ownership?.[0]}
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="SHARED">Compartilhada</option>
        </SelectField>
      </div>
      {ownership === "INDIVIDUAL" && (
        <SelectField
          label="Titular"
          name="holderMemberId"
          defaultValue={members[0]?.id}
          error={state.fieldErrors?.holderMemberId?.[0]}
          required
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </SelectField>
      )}
      <FormField
        label="Saldo inicial"
        name="openingBalance"
        defaultValue="0,00"
        inputMode="decimal"
        error={state.fieldErrors?.openingBalance?.[0]}
        hint="Use valor negativo caso a conta já esteja no vermelho."
        required
      />
      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Landmark className="size-4" />}
        {pending ? "Criando…" : "Criar conta"}
      </button>
    </form>
  );
}
