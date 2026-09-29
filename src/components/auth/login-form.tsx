"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { loginAction } from "@/features/auth/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(
    loginAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        error={state.fieldErrors?.email?.[0]}
        required
      />
      <FormField
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Sua senha"
        error={state.fieldErrors?.password?.[0]}
        required
      />
      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(50,154,98,0.2)] hover:bg-brand-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-65"
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Entrando…
          </>
        ) : (
          <>
            Entrar
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
