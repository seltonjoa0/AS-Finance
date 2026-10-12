"use client";

import { CheckCircle2, LoaderCircle, LockKeyhole, Wallet } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import {
  closeCreditCardInvoiceAction,
  payCreditCardInvoiceAction,
} from "@/features/finance/credit-card-actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type InvoiceStatus = "OPEN" | "CLOSED" | "PAID";

type CreditCardInvoiceControlsProps = {
  invoiceId: string;
  status: InvoiceStatus;
  cardName: string;
  closingDate: string;
  paymentAccounts: Array<{ id: string; label: string }>;
  today: string;
};

export function CreditCardInvoiceControls({
  invoiceId,
  status,
  cardName,
  closingDate,
  paymentAccounts,
  today,
}: CreditCardInvoiceControlsProps) {
  const canClose = closingDate <= today;
  const [year, month, day] = closingDate.split("-");
  const closingDateLabel = [day, month, year].join("/");
  const closeAction = closeCreditCardInvoiceAction.bind(null, invoiceId);
  const paymentAction = payCreditCardInvoiceAction.bind(null, invoiceId);
  const [closeState, submitClose, closePending] = useActionState(
    closeAction,
    INITIAL_FORM_STATE,
  );
  const [paymentState, submitPayment, paymentPending] = useActionState(
    paymentAction,
    INITIAL_FORM_STATE,
  );

  if (status === "PAID") {
    return (
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-xs font-bold text-brand-800">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Fatura quitada
      </div>
    );
  }

  if (status === "OPEN") {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <form
          action={submitClose}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Fechar esta fatura do cartão “" +
                  cardName +
                  "”? Depois disso, ela não aceitará novas compras.",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={closePending || !canClose}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-xs font-bold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {closePending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LockKeyhole className="size-4" aria-hidden="true" />
            )}
            {closePending
              ? "Fechando…"
              : canClose
                ? "Fechar fatura"
                : "Fecha em " + closingDateLabel}
          </button>
        </form>
        {!canClose && (
          <p className="mt-2 text-xs leading-5 text-muted">
            O fechamento ficará disponível nessa data. Até lá, novas compras
            continuam entrando nesta fatura.
          </p>
        )}
        <div className="mt-3">
          <FormAlert state={closeState} />
        </div>
      </div>
    );
  }

  if (paymentAccounts.length === 0) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
          Cadastre uma conta para registrar o pagamento desta fatura.{" "}
          <Link href="/app/contas" className="font-bold underline">
            Ir para contas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <form
        action={submitPayment}
        className="space-y-3"
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Registrar o pagamento integral da fatura do cartão “" +
                cardName +
                "”?",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <SelectField
          label="Pagar com"
          name="sourceAccountId"
          defaultValue=""
          error={paymentState.fieldErrors?.sourceAccountId?.[0]}
          required
        >
          <option value="">Selecione a conta</option>
          {paymentAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </SelectField>
        <FormField
          label="Data do pagamento"
          name="paymentDate"
          type="date"
          defaultValue={today}
          max={today}
          error={paymentState.fieldErrors?.paymentDate?.[0]}
          required
        />
        <FormAlert state={paymentState} />
        <button
          type="submit"
          disabled={paymentPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paymentPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wallet className="size-4" aria-hidden="true" />
          )}
          {paymentPending ? "Registrando…" : "Registrar pagamento"}
        </button>
      </form>
    </div>
  );
}
