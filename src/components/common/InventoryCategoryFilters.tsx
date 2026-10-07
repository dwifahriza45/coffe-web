import type { CategoryIngredient, IngredientSubcategory } from "../../api/categoryIngredient.api";
import { useLanguage } from "../../app/LanguageContext";
import { inventorySectionLabel } from "../../utils/stockDisplay";

type Props = {
 categories: CategoryIngredient[]; subcategories: IngredientSubcategory[];
 category: string; subcategory: string; counts: Record<string, number>; total: number | null;
 onCategory: (id: string) => void; onSubcategory: (id: string) => void;
};
export default function InventoryCategoryFilters({categories,subcategories,category,subcategory,counts,total,onCategory,onSubcategory}: Props) {
 const {t}=useLanguage();
 const selectedSubs=category ? subcategories.filter((sub) => sub.category_ingredient_id===category) : [];
 return <>
  <div className="mt-6 flex flex-wrap gap-3" aria-label={t("Ingredient Category")}>
   {[{category_ingredient_id:"",name:t("All sections")},...categories].map((item) => {
    const active=category===item.category_ingredient_id;
    const count=total===null ? "…" : item.category_ingredient_id ? counts[item.category_ingredient_id] ?? 0 : total;
    return <button key={item.category_ingredient_id} type="button" aria-pressed={active} title={item.category_ingredient_id ? item.name : undefined} onClick={() => onCategory(item.category_ingredient_id)} className={`inline-flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold transition ${active ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-cream)]" : "bg-[var(--color-brand-soft)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-sage)]"}`}>
     {item.category_ingredient_id ? inventorySectionLabel(item.name) : item.name}<span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs ${active ? "bg-[var(--color-brand-sage)] text-[var(--color-brand-primary)]" : "bg-[var(--color-brand-cream)]"}`}>{count}</span>
    </button>;
   })}
  </div>
  {selectedSubs.length>0 && <div className="mt-4 border-t border-stone-200/70 pt-4">
   <p className="mb-2 text-xs font-semibold text-stone-500">{t("Ingredient subcategory")}</p>
   <div className="flex flex-wrap gap-2" aria-label={t("Ingredient subcategory")}>
    {[{subcategory_ingredient_id:"",name:t("All subcategories")},...selectedSubs].map((sub) => <button key={sub.subcategory_ingredient_id} type="button" aria-pressed={subcategory===sub.subcategory_ingredient_id} onClick={() => onSubcategory(sub.subcategory_ingredient_id)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${subcategory===sub.subcategory_ingredient_id ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-cream)]" : "border-stone-200 bg-white text-stone-600 hover:bg-[var(--color-brand-soft)]"}`}>{sub.name}</button>)}
   </div>
  </div>}
 </>;
}
