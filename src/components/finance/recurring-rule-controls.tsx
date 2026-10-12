"use client";

import {
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import {
  endRecurringRuleAction,
  materializeRecurringRulesAction,
  toggleRecurringRuleAction,
} from "@/features/finance/recurrence-actions";
import { INITIAL_FORM_STATE } from "@/lib/validation/form-state";

type RecurringRuleControlsProps = {
  ruleId: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  description: string;
};

export function RecurringRuleControls({
  ruleId,
  status,
  description,
}: RecurringRuleControlsProps) {
  const toggleAction = toggleRecurringRuleAction.bind(null, ruleId);
  const endAction = endRecurringRuleAction.bind(null, ruleId);
  const [toggleState, submitToggle, togglePending] = useActionState(
    toggleAction,
    INITIAL_FORM_STATE,
  );
  const [endState, submitEnd, endPending] = useActionState(
    endAction,
    INITIAL_FORM_STATE,
  );

  if (status === "ENDED") return null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <form action={submitToggle} className="min-w-0 flex-1">
          <button
            type="submit"
            disabled={togglePending || endPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-xs font-bold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {togglePending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : status === "ACTIVE" ? (
              <PauseCircle className="size-4" aria-hidden="true" />
            ) : (
              <PlayCircle className="size-4" aria-hidden="true" />
            )}
            {togglePending
              ? "Atualizando…"
              : status === "ACTIVE"
                ? "Pausar"
                : "Retomar"}
          </button>
        </form>
        <form
          action={submitEnd}
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Encerrar a recorrência “${description}”? As previsões futuras pendentes serão retiradas.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            disabled={togglePending || endPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {endPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <StopCircle className="size-4" aria-hidden="true" />
            )}
            {endPending ? "Encerrando…" : "Encerrar"}
          </button>
        </form>
      </div>
      <div className="mt-3 space-y-2">
        <FormAlert state={toggleState} />
        <FormAlert state={endState} />
      </div>
    </div>
  );
}

export function MaterializeRecurringRulesButton() {
  const [state, action, pending] = useActionState(
    materializeRecurringRulesAction,
    INITIAL_FORM_STATE,
  );

  return (
    <div className="sm:text-right">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {pending ? "Atualizando…" : "Atualizar previsões"}
        </button>
      </form>
      {state.message && (
        <div className="mt-2 min-w-64 text-left">
          <FormAlert state={state} />
        </div>
      )}
    </div>
  );
}
