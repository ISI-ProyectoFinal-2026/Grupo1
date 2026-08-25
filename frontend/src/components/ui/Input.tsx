import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

function Input({ label, error, hint, id, name, className = "", ...props }: InputProps) {
  const inputId = id ?? name;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={!!error}
        className={`rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? "border-red-500" : "border-gray-300"
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="text-sm text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-sm text-gray-500">{hint}</span>
      ) : null}
    </div>
  );
}

export default Input;
