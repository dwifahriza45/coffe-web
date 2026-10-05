import { X } from "lucide-react";
import type { FormEvent } from "react";
import { useLanguage } from "../../app/LanguageContext";

export default function NameFormDialog({
  open,
  title,
  name,
  onNameChange,
  onSubmit,
  onClose,
  submitting = false,
  nameError,
  error,
}: {
  open: boolean;
  title: string;
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  submitting?: boolean;
  nameError?: string;
  error?: string;
}) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-form-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-stone-200 p-5">
          <h2 id="name-form-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label={t("Close")}
            className="grid size-9 place-items-center rounded-lg hover:bg-stone-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block text-sm font-semibold text-stone-700">
            {t("Name")}
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={submitting}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-form-error" : undefined}
              className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"
            />
            {nameError && (
              <p
                id="name-form-error"
                className="mt-1.5 text-xs font-medium text-red-600"
              >
                {nameError}
              </p>
            )}
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t(submitting ? "Saving..." : "Save")}
          </button>
        </footer>
      </form>
    </div>
  );
}
