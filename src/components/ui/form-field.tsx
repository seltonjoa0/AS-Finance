import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  error,
  hint,
  id,
  name,
  className = "",
  ...props
}: FormFieldProps) {
  const fieldId = id ?? name;
  const describedBy = [error && `${fieldId}-error`, hint && `${fieldId}-hint`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`h-12 w-full rounded-2xl border bg-white px-4 text-[15px] text-ink shadow-[0_1px_2px_rgba(20,40,28,0.02)] outline-none transition placeholder:text-[#a3aaa5] ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
            : "border-line hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
