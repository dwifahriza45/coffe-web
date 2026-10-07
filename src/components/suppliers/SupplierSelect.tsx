import { useEffect, useState } from "react";
import { getSuppliers, type Supplier } from "../../api/supplier.api";

export default function SupplierSelect({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const all: Supplier[] = [];
        for (let start = 0; ; start += 100) {
          const response = await getSuppliers({ start, limit: 100, name: "" });
          if (!current) return;
          const page = response.data ?? [];
          all.push(...page);
          if (page.length < 100 || (response.total !== undefined && all.length >= response.total)) break;
        }
        setSuppliers(all.filter((supplier) => supplier.active).sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (current) setError(true);
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => { current = false; };
  }, [retry]);

  // Keep the saved name visible for older receipts or inactive/deleted suppliers.
  const hasSavedValue = value && !suppliers.some((supplier) => supplier.name === value);
  return (
    <>
      <select required aria-required="true" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || error} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10 disabled:bg-stone-100">
        <option value="">{loading ? "Loading suppliers..." : error ? "Could not load suppliers" : "Select supplier"}</option>
        {hasSavedValue && <option value={value} disabled>{value}{!loading && !error ? " (saved supplier)" : ""}</option>}
        {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.name}>{supplier.name}</option>)}
      </select>
      {error && <span role="alert" className="mt-2 block text-xs font-normal text-red-600">Could not load suppliers. <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Try again</button></span>}
      {!loading && !error && suppliers.length === 0 && <span className="mt-2 block text-xs font-normal text-stone-500">No active suppliers. Add or activate a supplier in Master Data.</span>}
    </>
  );
}
