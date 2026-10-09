import { ArrowLeft, CupSoda, FolderTree, LayoutGrid, List, Search } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getOperationalCategories, getOperationalProducts, getOperationalDetail, type OperationalCategory, type OperationalProduct, type OperationalDetail } from "../../api/operationalMenu.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { formatNumber } from "../../utils/numberFormat";

export default function OperationalMenuPage() {
  const {productID,recipeID} = useParams();
  const [params] = useSearchParams();
  const categoryID = params.get("category") || "";
  const all = params.get("all") === "1";
  const detailID = recipeID || productID;
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [categories,setCategories] = useState<OperationalCategory[]>([]);
  const [products,setProducts] = useState<OperationalProduct[]>([]);
  const [detail,setDetail] = useState<OperationalDetail | null>(null);
  const [selected,setSelected] = useState("");
  const [view,setView] = useState<"grid" | "table">("grid");
  const [search,setSearch] = useState("");
  const [page,setPage] = useState(1);
  const [limit,setLimit] = useState(10);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  useEffect(() => {setPage(1);setSearch("");},[categoryID,all,detailID]);
  useEffect(() => {
    let current = true;
    setLoading(true);setError("");setDetail(null);setProducts([]);
    async function load() {
      try {
        if (detailID) {
          const response = await getOperationalDetail(detailID,Boolean(recipeID));
          if (!current) return;
          const data = response.data || null;
          setDetail(data);setSelected(data?.recipes.find((r) => !r.is_base)?.recipe_id || data?.recipes[0]?.recipe_id || "");
        } else if (categoryID || all) {
          const response = await getOperationalProducts({start:(page-1)*limit,limit,name:search,category_id:categoryID});
          if (!current) return;
          setProducts(response.data || []);setTotal(response.total || 0);
        } else {
          const response = await getOperationalCategories();
          if (current) setCategories(response.data || []);
        }
      } catch (error) {
        if (current) setError(isAxiosError<{message?: string}>(error) ? error.response?.data?.message || "Gagal memuat Resep Item." : "Gagal memuat Resep Item.");
      } finally {if (current) setLoading(false);}
    }
    void load();return () => {current=false};
  },[detailID,recipeID,categoryID,all,page,limit,search]);
  const recipe = detail?.recipes.find((r) => r.recipe_id === selected);
  const pages = Math.max(1,Math.ceil(total/limit));
  const categoryView = !detailID && !categoryID && !all;
  const filteredCategories = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const cardClass = "rounded-2xl border border-[var(--color-brand-sage)] bg-[var(--color-brand-surface)] p-5 text-left transition hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-soft)]";
  return <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <section className="min-w-0 flex-1"><Navbar onMenuClick={() => setSidebarOpen(true)} /><main className="p-5 sm:p-8">
      {!categoryView && <Link to={recipeID && detail ? `/operational-menu/products/${encodeURIComponent(detail.product.product_id)}` : "/operational-menu"} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600"><ArrowLeft size={17} />Resep Item</Link>}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-hover)]"><CupSoda size={22} /></div><h1 className="font-serif text-3xl font-bold">{detail?.product.name || "Resep Item"}</h1><p className="mt-2 text-sm text-stone-500">{detail ? `${detail.product.category_name}${detail.product.description ? ` · ${detail.product.description}` : ""}` : "Lihat menu dan komposisi resep untuk operasional."}</p></div>
        {!detailID && <div className="flex flex-wrap gap-3"><div role="group" aria-label="Tampilan Resep Item" className="inline-flex gap-1 rounded-full border border-stone-200 p-1">{(["grid","table"] as const).map((mode) => {const Icon=mode==="grid"?LayoutGrid:List;return <button key={mode} type="button" aria-pressed={view===mode} onClick={() => setView(mode)} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${view===mode ? "bg-[var(--color-brand-primary)] text-white" : "text-stone-600"}`}><Icon size={15} />{mode==="grid"?"Grid":"Table"}</button>})}</div>{categoryView && <Link to="/operational-menu?all=1" className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-semibold">Semua menu</Link>}</div>}
      </header>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <p className="mt-7 rounded-xl bg-white p-10 text-center text-stone-500">Memuat Resep Item…</p> : detailID ? detail && <div className="mt-7 grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="overflow-hidden rounded-xl border border-stone-200 bg-white"><h2 className="border-b p-4 font-bold">Versi Resep</h2>{detail.recipes.length ? detail.recipes.map((r) => <button key={r.recipe_id} type="button" onClick={() => setSelected(r.recipe_id)} className={`block w-full border-b p-4 text-left ${selected===r.recipe_id ? "bg-[var(--color-brand-soft)]" : "hover:bg-stone-50"}`}><span className="block font-semibold">{r.version}</span><span className="mt-1 block text-xs text-stone-500">{r.is_base?"Base racikan":"Resep menu"} · {r.recipe_category}</span></button>) : <p className="p-4 text-sm text-stone-500">Belum ada resep aktif.</p>}</aside>
        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white"><header className="border-b p-5"><h2 className="font-bold">{recipe?.version || "Detail resep"}</h2>{recipe?.is_base && recipe.yield_quantity && <p className="mt-1 text-sm text-stone-500">Hasil akhir {formatNumber(recipe.yield_quantity,3)} {recipe.yield_unit}</p>}</header><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 uppercase text-stone-500"><tr><th className="p-4">Item / base</th><th className="p-4 text-right">Qty</th><th className="p-4">Satuan</th></tr></thead><tbody>{recipe?.items.length ? recipe.items.map((item,i) => <tr key={i} className="border-t"><td className="p-4 font-semibold">{item.base_recipe_id ? <Link className="text-[var(--color-brand-accent)] underline" to={`/operational-menu/recipes/${encodeURIComponent(item.base_recipe_id)}`}>{item.name}</Link> : item.name}</td><td className="p-4 text-right">{formatNumber(item.quantity,3)}</td><td className="p-4">{item.unit}</td></tr>) : <tr><td colSpan={3} className="p-10 text-center text-stone-500">Belum ada item resep.</td></tr>}</tbody></table></div></section>
      </div> : <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-bold">{categoryView ? "Kategori Menu" : "Menu"}</h2><p className="text-xs text-stone-500">{categoryView ? filteredCategories.length : total} data ditemukan</p></div><label className="flex items-center gap-2 rounded-lg border px-3 py-2"><Search size={16} className="text-stone-400" /><input aria-label="Cari Resep Item" placeholder={categoryView ? "Cari kategori…" : "Cari menu…"} value={search} onChange={(e) => {setSearch(e.target.value);setPage(1)}} className="bg-transparent text-sm outline-none" /></label></header>
        {view==="grid" ? <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">{categoryView ? filteredCategories.map((c) => <Link key={c.category_id} to={`/operational-menu?category=${encodeURIComponent(c.category_id)}`} className={cardClass}><FolderTree size={25} className="mb-4 text-[var(--color-brand-primary)]" /><h3 className="text-lg font-bold">{c.name}</h3><p className="mt-2 text-sm text-stone-500">{c.description || "—"}</p><p className="mt-4 text-xs text-stone-500">{c.product_count} menu</p></Link>) : products.map((p) => <Link key={p.product_id} to={`/operational-menu/products/${encodeURIComponent(p.product_id)}`} className={cardClass}><CupSoda size={25} className="mb-4 text-[var(--color-brand-primary)]" /><h3 className="text-lg font-bold">{p.name}</h3><p className="mt-1 text-xs text-stone-500">{p.category_name}</p><p className="mt-3 text-sm text-stone-500">{p.description || "—"}</p></Link>)}</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50"><tr><th className="p-4">{categoryView?"Kategori":"Menu"}</th><th className="p-4">{categoryView?"Jumlah menu":"Kategori"}</th><th className="p-4">Deskripsi</th></tr></thead><tbody>{categoryView?filteredCategories.map((c)=><tr key={c.category_id} className="border-t"><td className="p-4 font-semibold"><Link className="underline" to={`/operational-menu?category=${encodeURIComponent(c.category_id)}`}>{c.name}</Link></td><td className="p-4">{c.product_count}</td><td className="p-4">{c.description||"—"}</td></tr>):products.map((p)=><tr key={p.product_id} className="border-t"><td className="p-4 font-semibold"><Link className="underline" to={`/operational-menu/products/${encodeURIComponent(p.product_id)}`}>{p.name}</Link></td><td className="p-4">{p.category_name}</td><td className="p-4">{p.description||"—"}</td></tr>)}</tbody></table></div>}
        {(categoryView ? !filteredCategories.length : !products.length) && <p className="p-10 text-center text-sm text-stone-500">Belum ada menu ditemukan.</p>}
        {!categoryView && <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-stone-500"><label>Halaman {page} dari {pages} · Limit <select aria-label="Limit Resep Item" value={limit} onChange={(e)=>{setLimit(Number(e.target.value));setPage(1)}} className="ml-2 rounded border p-2">{[10,20,30,40,50].map((n)=><option key={n}>{n}</option>)}</select></label><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded border px-3 py-2 disabled:opacity-40">Sebelumnya</button><button disabled={page>=pages} onClick={()=>setPage(page+1)} className="rounded border px-3 py-2 disabled:opacity-40">Berikutnya</button></div></footer>}
      </section>}
    </main></section>
  </div>;
}
