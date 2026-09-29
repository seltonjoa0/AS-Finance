import type { ZodError } from "zod";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const INITIAL_FORM_STATE: FormState = { status: "idle" };

export function fieldErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string[]>>((errors, issue) => {
    const key = String(issue.path[0] ?? "form");
    errors[key] = [...(errors[key] ?? []), issue.message];
    return errors;
  }, {});
}
