import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

function Input({ label, error, hint, id, name, className = "", ...props }: InputProps) {
  const inputId = id ?? name;
  const messageId = inputId ? `${inputId}-message` : undefined;
  const hasMessage = Boolean(error || hint);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={!!error}
        aria-describedby={hasMessage ? messageId : undefined}
        className={cn("field", className)}
        {...props}
      />
      {error ? (
        <span id={messageId} className="text-sm font-bold text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="text-sm text-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export default Input;
