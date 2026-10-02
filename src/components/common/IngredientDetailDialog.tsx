import { isAxiosError } from "axios";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getIngredientPrice, type IngredientPrice } from "../../api/ingredientPrice.api";
import { useLanguage } from "../../app/LanguageContext";
import { formatNumber } from "../../utils/numberFormat";

export default function IngredientDetailDialog({ priceID, onClose }: {
  priceID: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState<IngredientPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setItem(null);
    async function loadDetail() {
      try {
        const response = await getIngredientPrice(priceID);
        if (!response.data?.ingredient_info) throw new Error("Ingredient detail unavailable");
        if (current) setItem(response.data);
      } catch (requestError) {
        if (current) setError(isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data?.message || t("Could not load ingredient details.")
          : t("Could not load ingredient details."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadDetail();
    return () => { current = false; };
  }, [priceID, retry, t]);

  const ingredient = item?.ingredient_info;
  const unit = item?.content_unit_info;
  const quantity = (value?: string, code?: string) => value
    ? `${formatNumber(value, 3)}${code ? ` ${code}` : ""}` : "-";
  const status = (active: boolean) => t(active ? "Active" : "Inactive");

  return (
    <dialog ref={dialogRef} aria-labelledby="ingredient-detail-title"
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-2xl bg-white p-0 text-stone-800 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 p-5">
          <div>
            <h2 id="ingredient-detail-title" className="text-lg font-bold">{t("Ingredient Detail")}</h2>
            {ingredient && <p className="mt-1 text-sm text-stone-500">{ingredient.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
          {loading && <p role="status" className="py-10 text-center text-sm text-stone-500">{t("Loading ingredients...")}</p>}
          {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 font-semibold underline">{t("Retry")}</button></div>}
          {item && ingredient && <>
            <DetailSection title={t("Ingredient")}>
              <Detail label={t("Name")} value={ingredient.name} />
              <Detail label={t("Ingredient ID")} value={ingredient.ingredient_id} />
              <Detail label={t("Ingredient Category")} value={ingredient.category_ingredient_name || ingredient.category_ingredient_id} />
              <Detail label={t("Brand / Type")} value={item.brand_type_info?.name || ingredient.brand_type_id} />
              <Detail label={t("Minimum stock") + " / PAR"} value={quantity(ingredient.minimum_stock, unit?.code)} />
              <Detail label={t("Status")} value={status(ingredient.active)} />
              <Detail label={t("Usage")} value={typeof ingredient.in_use === "boolean" ? t(ingredient.in_use ? "Used" : "Unused") : "-"} />
            </DetailSection>
            <DetailSection title={t("Packaging unit")}>
              <Detail label={t("Packaging unit")} value={item.packaging_info ? `${item.packaging_info.name} (${item.packaging_info.code})` : ingredient.packaging_id} />
              <Detail label={t("Package Qty")} value={quantity(ingredient.package_qty)} />
              <Detail label={t("Content Qty")} value={quantity(ingredient.content_qty, unit?.code)} />
              <Detail label={t("Content unit")} value={unit ? `${unit.name} (${unit.code})` : ingredient.content_unit_id} />
            </DetailSection>
            <DetailSection title={t("Supplier")}>
              <Detail label={t("Name")} value={item.supplier_info?.name || ingredient.supplier_id} />
              <Detail label={t("Status")} value={item.supplier_info ? status(item.supplier_info.active) : "-"} />
              <Detail label={t("Phone")} value={item.supplier_info?.phone} />
              <Detail label={t("Email")} value={item.supplier_info?.email} />
              <Detail label={t("Address")} value={item.supplier_info?.address} />
            </DetailSection>
            <DetailSection title={t("Price")}>
              <Detail label={t("Price ID")} value={item.price_id} />
              <Detail label={t("Price")} value={`Rp ${formatNumber(item.price, 2)}`} />
              <Detail label={t("Unit Price")} value={`Rp ${formatNumber(item.unit_price, 2)}${unit?.code ? ` / ${unit.code}` : ""}`} />
              <Detail label={t("Effective Date")} value={item.effective_date.slice(0, 10)} />
              <Detail label={t("Status")} value={status(item.active)} />
            </DetailSection>
          </>}
        </div>
        <footer className="flex shrink-0 justify-end border-t border-stone-200 p-5"><button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Close")}</button></footer>
      </div>
    </dialog>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="mb-3 font-semibold">{title}</h3><dl className="grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">{children}</dl></section>;
}

function Detail({ label, value }: { label: string; value?: string }) {
  return <div className="min-w-0"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value || "-"}</dd></div>;
}
