import { Coffee } from "lucide-react";
export default function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 text-sm font-bold tracking-[.2em] ${dark ? "text-stone-900" : "text-white"}`}
    >
      <span className="grid size-10 place-items-center rounded-full bg-[#b96c43] text-white">
        <Coffee size={20} />
      </span>
      C.R.E.M.A
    </div>
  );
}
