import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type TableActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: "default" | "info" | "danger";
};

const variantClass = {
  default:
    "border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent",
  info:
    "border-sky-200 text-sky-700 hover:bg-sky-50 disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent",
  danger:
    "border-red-200 text-red-600 hover:bg-red-50 disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent",
};

export default function TableActionButton({
  children,
  disabled = false,
  label,
  onClick,
  to,
  variant = "default",
}: TableActionButtonProps) {
  const className = `grid size-8 place-items-center rounded-lg border transition ${variantClass[variant]} ${disabled ? "cursor-not-allowed" : ""}`;
  if (to && !disabled) {
    return (
      <Link to={to} className={className} title={label} aria-label={label}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
