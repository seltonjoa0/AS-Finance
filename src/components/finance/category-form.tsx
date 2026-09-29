"use client";

import { FolderPlus, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { createCategoryAction } from "@/features/finance/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

export function CategoryForm() {
  const [state, action, pending] = useActionState(createCategoryAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormField
        label="Nome da categoria"
        name="name"
        placeholder="Ex.: Moradia"
        error={state.fieldErrors?.name?.[0]}
        maxLength={80}
        required
      />
      <SelectField label="Tipo" name="type" defaultValue="EXPENSE" error={state.fieldErrors?.type?.[0]}>
        <option value="EXPENSE">Despesa</option>
        <option value="INCOME">Receita</option>
      </SelectField>
      <FormAlert state={state} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
        {pending ? "Criando…" : "Criar categoria"}
      </button>
    </form>
  );
}
