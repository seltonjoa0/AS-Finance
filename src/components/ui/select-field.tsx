import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

export function SelectField({
  label,
  error,
  hint,
  id,
  name,
  className = "",
  children,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? name;
  const describedBy = [error && `${fieldId}-error`, hint && `${fieldId}-hint`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={fieldId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`h-12 w-full rounded-2xl border bg-white px-4 text-[15px] text-ink outline-none transition ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
            : "border-line hover:border-[#cfd8d2] focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
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
