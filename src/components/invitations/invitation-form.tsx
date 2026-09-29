"use client";

import { Check, Copy, LoaderCircle, Send } from "lucide-react";
import { useActionState, useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import {
  createInvitationAction,
  type InvitationFormState,
} from "@/features/invitations/actions";

const INITIAL_STATE: InvitationFormState = { status: "idle" };

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, INITIAL_STATE);
  const [copied, setCopied] = useState(false);

  async function copyInvitation() {
    if (!state.invitationPath) return;
    const invitationUrl = new URL(state.invitationPath, window.location.origin).toString();
    await navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField
        label="E-mail da pessoa"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="pessoa@exemplo.com"
        error={state.fieldErrors?.email?.[0]}
        required
      />
      <FormAlert state={state} />
      {state.invitationPath && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3">
          <label htmlFor="invitation-url" className="text-xs font-bold text-brand-800">
            Link válido por 7 dias
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="invitation-url"
              readOnly
              value={state.invitationPath}
              className="h-10 min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 text-xs text-ink outline-none"
            />
            <button
              type="button"
              onClick={copyInvitation}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-brand-800 shadow-sm hover:bg-brand-100"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "Criando…" : "Criar convite"}
      </button>
    </form>
  );
}
