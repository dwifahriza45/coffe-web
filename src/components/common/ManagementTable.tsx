import type { ReactNode } from "react";

/** Shared accessible scroll container and management table styles. */
export default function ManagementTable({
  label,
  headers,
  children,
  className = "min-w-[650px] text-sm",
}: {
  label: string;
  headers: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className={`w-full text-left ${className}`}>
        <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
          <tr>{headers}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}
