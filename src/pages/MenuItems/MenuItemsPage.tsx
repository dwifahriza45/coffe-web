import { getCategories, type Category } from "../../api/category.api";
import { getRecipes, getRecipeCost, type Recipe } from "../../api/recipe.api";
import { exportAllRecipeHpp } from "../../utils/recipeHppReport";
import { useAuth } from "../../app/AuthContext";
import { userCan } from "../../app/roleAccess";
import { CupSoda, Search, Download, ChevronDown } from "lucide-react";
import { isAxiosError } from "axios";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getProducts, type Product } from "../../api/product.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useLanguage } from "../../app/LanguageContext";
import { formatNumber } from "../../utils/numberFormat";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export default function MenuItemsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  async function handleExportHpp() {
    if (exporting) return;
    setExporting(true); setError(""); setExportProgress("");
    try { await exportAllRecipeHpp((done, total) => setExportProgress(`${done}/${total}`)); }
    catch (error) { setError(isAxiosError<{message?: string}>(error) ? error.response?.data?.message || "Gagal export HPP." : error instanceof Error ? error.message : "Gagal export HPP."); }
    finally { setExporting(false); setExportProgress(""); }
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hpp,setHpp]=useState<Record<string,{versions:{recipe:Recipe;value:string|null;note:string}[];note:string}>>({});
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
  const canReadRecipes=userCan(user,"recipes");
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryID,setCategoryID]=useState("");
  const [categories,setCategories]=useState<Category[]>([]);
  const [categoryError,setCategoryError]=useState("");
  const [loadingCategories,setLoadingCategories]=useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(()=>{
    let current=true;
    async function load(){
      setLoadingCategories(true);setCategoryError("");
      try{const rows:Category[]=[];for(let start=0;current;start+=100){const response=await getCategories({start,limit:100,name:""});const next=response.data||[];rows.push(...next);if(next.length<100)break;}if(current)setCategories(rows);}
      catch{if(current)setCategoryError("Gagal memuat pilihan kategori.");}
      finally{if(current)setLoadingCategories(false);}
    }
    void load();return()=>{current=false};
  },[refreshKey]);

  useEffect(() => {
    let current = true;
    async function loadProducts() {
      setLoading(true);setHpp({});setExpanded(new Set());
      setError("");
      try {
        const response = await getProducts({
          start: (page - 1) * pageSize,
          limit: pageSize,
          name: search,
          category_id: categoryID,
        });
        if (!current) return;
        const nextProducts = response.data ?? [];
        if (!current) return;
        setProducts(nextProducts);
        setTotal(response.total ?? 0);
        if(canReadRecipes){
          const prices:Record<string,{versions:{recipe:Recipe;value:string|null;note:string}[];note:string}>={};
          let index=0;
          await Promise.all(Array.from({length:Math.min(4,nextProducts.length)},async()=>{
            while(current&&index<nextProducts.length){
              const product=nextProducts[index++];
              try{
                const recipes:Recipe[]=[];
                for(let start=0;current;start+=100){const result=await getRecipes({start,limit:100,name:"",product_id:product.product_id});const rows=result.data||[];recipes.push(...rows);if(rows.length<100)break;}
                if(!current)return;
                const menuRecipes=recipes.filter(r=>!r.is_base);
                const versions:{recipe:Recipe;value:string|null;note:string}[]=[];
                for(const recipe of menuRecipes){
                  if(!current)return;
                  try{const result=await getRecipeCost(recipe.recipe_id);versions.push({recipe,value:result.data?.complete?result.data.total_cost:null,note:result.data?.complete?"":result.data?.issues.join("; ")||"HPP belum lengkap"});}
                  catch{versions.push({recipe,value:null,note:"Gagal memuat HPP"});}
                }
                prices[product.product_id]={versions,note:versions.length?"":"Belum ada resep menu"};
              }catch{prices[product.product_id]={versions:[],note:"Gagal memuat versi resep"};}
            }
          }));
          if(current)setHpp(prices);
        }

      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setProducts([]);
        setTotal(0);
        setError(response?.message || t("Could not load menu items."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadProducts();
    return () => {
      current = false;
    };
  }, [page, pageSize, search, refreshKey, canReadRecipes, categoryID]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-accent)]">
                <CupSoda size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">HPP</h1>
              <p className="mt-2 text-sm text-stone-500">Buka menu untuk membandingkan HPP tiap versi resep. Base racikan tersedia di detail.</p>
            </div>
            <div className="flex flex-wrap gap-3">{userCan(user,"recipes")&&<button type="button" disabled={exporting} onClick={()=>void handleExportHpp()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><Download size={17}/>{exporting?`Export HPP ${exportProgress||"…"}`:"Export Semua HPP"}</button>}<button type="button" disabled={loading} onClick={() => setRefreshKey(value => value + 1)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Perbarui menu</button></div>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t("All menu items")}</h2>
                <p className="text-xs text-stone-500">{total} {t("menu items found")}</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <label className="relative w-full sm:w-48"><span className="sr-only">Kategori menu</span>
                <select aria-label="Filter kategori menu" value={categoryID} disabled={loadingCategories} onChange={e=>{setCategoryID(e.target.value);setPage(1)}} className="h-11 w-full appearance-none rounded-lg border border-[var(--color-brand-sage)] bg-white pl-3 pr-10 text-sm text-stone-700 outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10 disabled:opacity-50">
                  <option value="">{loadingCategories?"Memuat kategori…":"Semua kategori"}</option>
                  {categories.map(category=><option key={category.category_id} value={category.category_id}>{category.name}{category.active?"":" (Nonaktif)"}</option>)}
                </select>
                <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" />
              </label>
              <form
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
                className="flex h-11 w-full items-center gap-2 rounded-lg border border-[var(--color-brand-sage)] px-3 sm:w-72 lg:w-80 focus-within:border-[var(--color-brand-accent)] focus-within:ring-4 focus-within:ring-[var(--color-brand-accent)]/10"
              >
                <Search size={17} className="text-stone-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t("Search menu item...")} />
              </form>
              </div>
            </div>
            {categoryError&&<p role="alert" className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{categoryError}</p>}
            {error && <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("Product")}</th>
                    <th className="px-5 py-3">{t("Category")}</th>
                    <th className="px-5 py-3">HPP satu porsi</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading menu items...")}</td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">{t("No menu items found")}</td></tr>
                  ) : (
                    products.map(product=>{
                      const data=hpp[product.product_id];const open=expanded.has(product.product_id);
                      return <Fragment key={product.product_id}>
                        <tr className="hover:bg-stone-50/70">
                          <td className="px-5 py-4">
                            <button type="button" aria-expanded={open} aria-controls={`versions-${product.product_id}`} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(next.has(product.product_id))next.delete(product.product_id);else next.add(product.product_id);return next})} className="flex items-start gap-3 text-left font-semibold text-[var(--color-brand-primary)]">
                              <ChevronDown size={17} className={`mt-0.5 shrink-0 transition-transform ${open?"":"-rotate-90"}`}/><span>{product.name}<span className="mt-1 block text-xs font-normal text-stone-500">{data?.versions.length?`${data.versions.length} versi resep`:data?.note||(!canReadRecipes?"Akses resep diperlukan":"Belum ada resep menu")}</span></span>
                            </button>
                            {product.description&&<p className="ml-7 mt-1 max-w-xs truncate text-xs text-stone-500">{product.description}</p>}
                          </td>
                          <td className="px-5 py-4 text-sm">{product.category_info?.name||"—"}</td>
                          <td className="px-5 py-4 text-sm text-stone-500">{data?.versions.length?"Lihat per versi":"—"}</td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.active?"bg-green-50 text-green-700":"bg-stone-100 text-stone-500"}`}>{product.active?t("Active"):t("Inactive")}</span></td>
                        </tr>
                        {open&&<tr><td colSpan={4} className="p-0"><div id={`versions-${product.product_id}`} className="border-l-4 border-[var(--color-brand-sage)] bg-stone-50/60 px-5 py-3">
                          {data?.versions.length?<table className="w-full text-left text-sm"><thead className="text-xs text-stone-500"><tr><th scope="col" className="px-3 pb-2">Versi resep</th><th scope="col" className="px-3 pb-2">HPP satu porsi</th><th scope="col" className="px-3 pb-2">Status resep</th><th scope="col" className="px-3 pb-2 text-right">Detail</th></tr></thead><tbody>{data.versions.map(({recipe,value,note})=><tr key={recipe.recipe_id} className="border-t border-stone-200"><td className="px-3 py-3 font-semibold"><Link to={`/menu-items/${encodeURIComponent(product.product_id)}?recipe=${encodeURIComponent(recipe.recipe_id)}`} className="text-[var(--color-brand-primary)] hover:underline">{recipe.version}</Link></td><td className="px-3 py-3"><p className="font-semibold">{value!==null?`Rp ${formatNumber(value,2)}`:"—"}</p>{note&&<p className="mt-1 text-xs text-stone-500">{note}</p>}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recipe.active?"bg-green-50 text-green-700":"bg-stone-100 text-stone-500"}`}>{recipe.active?t("Active"):t("Inactive")}</span></td><td className="px-3 py-3 text-right"><Link to={`/menu-items/${encodeURIComponent(product.product_id)}?recipe=${encodeURIComponent(recipe.recipe_id)}`} className="font-semibold text-[var(--color-brand-primary)] hover:underline">Detail</Link></td></tr>)}</tbody></table>:<div className="flex items-center justify-between gap-3 py-2 text-sm text-stone-500"><span>{data?.note||"Akses resep diperlukan"}</span><Link to={`/menu-items/${encodeURIComponent(product.product_id)}`} className="font-semibold text-[var(--color-brand-primary)] hover:underline">Detail menu</Link></div>}
                        </div></td></tr>}
                      </Fragment>;
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">{t("Page")} {page} {t("of")} {totalPages}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Limit")}
                  <select value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10">
                    {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Previous")}</button>
                <button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{t("Next")}</button>
              </div>
            </footer>
          </section>
        </main>
      </section>
    </div>
  );
}
