import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { FormState } from "@/lib/validation/form-state";

export function FormAlert({ state }: { state: FormState }) {
  if (!state.message) return null;

  const isSuccess = state.status === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm leading-relaxed ${
        isSuccess
          ? "border-brand-200 bg-brand-50 text-brand-800"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{state.message}</span>
    </div>
  );
}
