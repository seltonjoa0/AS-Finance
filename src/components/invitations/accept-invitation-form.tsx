"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { acceptInvitationAction } from "@/features/invitations/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    acceptInvitationAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {pending ? "Entrando…" : "Entrar no espaço"}
      </button>
    </form>
  );
}
