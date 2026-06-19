import type { InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked: boolean;
  onChange: () => void;
}

export function Checkbox({ checked, onChange, className = '', ...props }: CheckboxProps) {
  return (
    <label
      className={`relative flex items-center justify-center w-5 h-5 rounded-full border-2 cursor-pointer
                  transition-all duration-150 ${checked
                    ? 'bg-brand-100 border-brand-100'
                    : 'border-zinc-600 hover:border-zinc-400'} ${className}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
        {...props}
      />
      {checked && (
        <svg className="w-3 h-3 text-zinc-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </label>
  );
}
