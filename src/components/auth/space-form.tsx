"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { createSpaceAction } from "@/features/spaces/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function SpaceForm() {
  const [state, action, pending] = useActionState(
    createSpaceAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        label="Nome do espaço"
        name="name"
        autoComplete="off"
        placeholder="Ex.: Finanças do casal"
        hint="Você poderá alterar esse nome quando quiser."
        error={state.fieldErrors?.name?.[0]}
        autoFocus
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
            Preparando…
          </>
        ) : (
          <>
            Criar meu espaço
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
