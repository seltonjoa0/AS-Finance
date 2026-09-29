"use client";

import { ArrowRightLeft, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createTransferAction } from "@/features/finance/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type TransferFormProps = {
  accounts: Array<{ id: string; label: string }>;
  today: string;
};

export function TransferForm({ accounts, today }: TransferFormProps) {
  const [state, action, pending] = useActionState(
    createTransferAction,
    INITIAL_FORM_STATE,
  );
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? "",
  );

  return (
    <form action={action} className="space-y-6" noValidate aria-busy={pending}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <SelectField
          label="Conta de origem"
          name="sourceAccountId"
          value={sourceAccountId}
          onChange={(event) => {
            const nextSource = event.target.value;
            setSourceAccountId(nextSource);
            if (destinationAccountId === nextSource) {
              setDestinationAccountId("");
            }
          }}
          error={state.fieldErrors?.sourceAccountId?.[0]}
          required
          className="truncate"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.label}</option>
          ))}
        </SelectField>
        <span className="mb-1 hidden size-10 place-items-center rounded-xl bg-brand-100 text-brand-700 sm:grid">
          <ArrowRightLeft className="size-4" aria-hidden="true" />
        </span>
        <SelectField
          label="Conta de destino"
          name="destinationAccountId"
          value={destinationAccountId}
          onChange={(event) => setDestinationAccountId(event.target.value)}
          error={state.fieldErrors?.destinationAccountId?.[0]}
          required
          className="truncate"
        >
          <option value="" disabled>Selecione a conta de destino</option>
          {accounts
            .filter((account) => account.id !== sourceAccountId)
            .map((account) => (
              <option key={account.id} value={account.id}>{account.label}</option>
            ))}
        </SelectField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Valor"
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          error={state.fieldErrors?.amount?.[0]}
          required
        />
        <FormField
          label="Data da transferência"
          name="transferDate"
          type="date"
          defaultValue={today}
          max={today}
          error={state.fieldErrors?.transferDate?.[0]}
          required
        />
      </div>

      <FormField
        label="Descrição (opcional)"
        name="description"
        placeholder="Ex.: Reserva mensal"
        maxLength={160}
        error={state.fieldErrors?.description?.[0]}
      />

      <div className="space-y-2">
        <label htmlFor="notes" className="block text-sm font-semibold text-ink">
          Observações (opcional)
        </label>
        <textarea
          id="notes"
          name="notes"
          maxLength={500}
          rows={3}
          aria-invalid={Boolean(state.fieldErrors?.notes?.[0])}
          aria-describedby={state.fieldErrors?.notes?.[0] ? "notes-error" : undefined}
          className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-[#a3aaa5] hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          placeholder="Algum detalhe importante?"
        />
        {state.fieldErrors?.notes?.[0] && (
          <p id="notes-error" className="text-sm text-red-600" role="alert">{state.fieldErrors.notes[0]}</p>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        A transferência movimenta o saldo das contas, mas não entra como receita ou despesa.
      </div>

      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-sm font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRightLeft className="size-4" aria-hidden="true" />}
        {pending ? "Transferindo…" : "Registrar transferência"}
      </button>
    </form>
  );
}
