import { useLanguage } from "../../app/LanguageContext";

export default function UsageBadge({ inUse }: { inUse: boolean }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-stone-400"}`}
      />
      {t(inUse ? "Used" : "Unused")}
    </span>
  );
}
