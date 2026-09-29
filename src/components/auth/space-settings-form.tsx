"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { updateSpaceAction } from "@/features/spaces/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function SpaceSettingsForm({
  currentName,
  canEdit,
}: {
  currentName: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateSpaceAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        label="Nome do espaço"
        name="name"
        defaultValue={currentName}
        error={state.fieldErrors?.name?.[0]}
        disabled={!canEdit}
        required
      />
      <FormAlert state={state} />
      {canEdit && (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
      )}
    </form>
  );
}
