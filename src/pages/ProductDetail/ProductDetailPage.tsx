import { ArrowLeft, BookOpen, ListPlus, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getProduct, type Product } from "../../api/product.api";
import {
  createRecipeItem,
  deleteRecipeItem,
  getRecipeItems,
  updateRecipeItem,
  type RecipeItem,
  type RecipeItemPayload,
} from "../../api/recipeItem.api";
import {
  getRecipeIngredients,
  type RecipeIngredient,
  createRecipe,
  deleteRecipe,
  getRecipes,
  updateRecipe,
  type Recipe,
} from "../../api/recipe.api";
import RecipeCostPanel from "../../components/common/RecipeCostPanel";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import { matchesStockCountDepartment } from "../../utils/stockCountDepartment";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyRecipeForm = { product_id: "", recipe_category: "", version: "", active: true, is_base: false, serving_quantity: "", yield_quantity: "", initial_quantity: "", yield_unit: "" };
const emptyItemForm: RecipeItemPayload = { recipe_id: "", ingredient_id: "", base_recipe_id: "", quantity: "" };

function formatQuantity(value: string) {
  return formatNumber(value, 6);
}

export default function ProductDetailPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canWriteRecipes = ["recipes", "recipe_items"].some((key) => ["create", "update", "delete"].some((action) => userCan(user, key, action as "create" | "update" | "delete")));
  const { categoryID = "", productID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeID, setSelectedRecipeID] = useState("");
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [baseRecipes, setBaseRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [itemCategory, setItemCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState("");
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);
  const [recipeForm, setRecipeForm] = useState(emptyRecipeForm);
  const [recipeRows, setRecipeRows] = useState([{ ingredient_id: "", base_recipe_id: "", quantity: "" }]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    tone?: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    let current = true;
    async function loadProduct() {
      setLoading(true);
      setError("");
      setRecipes([]);
      setItems([]);
      try {
        const [productResponse, recipeResponse, ingredientResponse] = await Promise.all([
          getProduct(productID),
          getRecipes({ start: 0, limit: 100, name: "", product_id: productID }),
          canWriteRecipes ? getRecipeIngredients() : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;
        const nextProduct = productResponse.data ?? null;
        const currentProductID = nextProduct?.product_id ?? productID;
        const nextRecipes = (recipeResponse.data ?? []).filter((recipe) => recipe.product_id === currentProductID);
        setProduct(nextProduct);
        setRecipes(nextRecipes);
        setIngredients(ingredientResponse.data ?? []);
        const allRecipes: Recipe[] = [];
        if (canWriteRecipes) {
          for (let start = 0; ; start += 100) {
            const page = await getRecipes({ start, limit: 100, name: "", product_id: "" });
            allRecipes.push(...(page.data ?? []));
            if ((page.data ?? []).length < 100) break;
          }
        }
        if (!current) return;
        setBaseRecipes(allRecipes.filter(recipe => recipe.is_base && recipe.active));
        setSelectedRecipeID((currentID) => {
          const currentRecipe = nextRecipes.find((recipe) => recipe.recipe_id === currentID);
          if (currentRecipe?.active) return currentID;
          return nextRecipes.find((recipe) => recipe.active && !recipe.is_base)?.recipe_id
            ?? nextRecipes.find((recipe) => !recipe.is_base)?.recipe_id
            ?? nextRecipes.find((recipe) => recipe.active)?.recipe_id
            ?? nextRecipes[0]?.recipe_id ?? "";
        });
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setError(response?.message || t("Could not load product detail."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadProduct();
    return () => {
      current = false;
    };
  }, [productID, refreshKey, canWriteRecipes]);

  useEffect(() => {
    let current = true;
    async function loadItems() {
      if (!selectedRecipeID) {
        setItems([]);
        return;
      }
      setItemsLoading(true);
      try {
        const response = await getRecipeItems({
          start: 0,
          limit: 100,
          recipe_id: selectedRecipeID,
          ingredient_id: "",
          name: "",
        });
        if (current) setItems(response.data ?? []);
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setItems([]);
        setError(response?.message || t("Could not load recipe items."));
      } finally {
        if (current) setItemsLoading(false);
      }
    }
    void loadItems();
    return () => {
      current = false;
    };
  }, [selectedRecipeID, refreshKey]);

  function openRecipeModal(recipe?: Recipe) {
    setEditingRecipe(recipe ?? null);
    setRecipeRows([{ ingredient_id: "", base_recipe_id: "", quantity: "" }]);
    setRecipeForm(recipe ? { product_id: productID, recipe_category: recipe.recipe_category ?? "", version: String(recipe.version), active: recipe.active, is_base: recipe.is_base ?? false, serving_quantity: recipe.serving_quantity ?? "", yield_quantity: recipe.yield_quantity ?? "", initial_quantity: "", yield_unit: recipe.yield_unit ?? "" } : { ...emptyRecipeForm, product_id: productID });
    setFieldErrors({});
    setActionError("");
    setRecipeModalOpen(true);
  }

  function openItemModal(item?: RecipeItem) {
    setEditingItem(item ?? null);
    const recipeCategory = recipes.find(recipe => recipe.recipe_id === (item?.recipe_id ?? selectedRecipeID))?.recipe_category || item?.recipe_info?.recipe_category;
    const ingredient = ingredients.find(ingredient => ingredient.ingredient_id === item?.ingredient_id);
    const base = baseRecipes.find(base => base.recipe_id === item?.base_recipe_id) ?? item?.base_recipe_info;
    const categoryName = item?.ingredient_info?.category_ingredient_name ?? "";
    const ingredientCategory = ingredient?.recipe_category || (matchesStockCountDepartment(categoryName, "barista") ? "BEVERAGE" : matchesStockCountDepartment(categoryName, "kitchen") ? "KITCHEN" : "");
    setItemCategory(recipeCategory || base?.recipe_category || ingredientCategory || "");
    setItemForm(item ? { recipe_id: item.recipe_id, ingredient_id: item.ingredient_id, base_recipe_id: item.base_recipe_id ?? "", quantity: item.quantity } : { ...emptyItemForm, recipe_id: selectedRecipeID });
    setFieldErrors({});
    setActionError("");
    setItemModalOpen(true);
  }

  function submitRecipe(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setActionError("");
    if (!recipeForm.recipe_category) { setActionError("Pilih kategori KITCHEN atau BEVERAGE terlebih dahulu."); return; }
    if (!recipeForm.version.trim()) {
      setFieldErrors({ version: t("version is required") });
      return;
    }
    if (!editingRecipe) {
      const filled = recipeRows.filter(row => row.ingredient_id || row.base_recipe_id || row.quantity);
      const keys = filled.map(row => row.ingredient_id + ":" + row.base_recipe_id);
      if ((recipeForm.is_base && filled.length === 0) || filled.some(row => (!row.ingredient_id && !row.base_recipe_id) || !(Number(row.quantity) >= 0.001)) || new Set(keys).size !== keys.length) {
        setActionError("Pilih item dan isi quantity positif. Setiap item cukup satu baris.");
        return;
      }
    }
    if (recipeForm.is_base && (recipeForm.yield_quantity || recipeForm.yield_unit) && (!(Number(recipeForm.yield_quantity) > 0) || !recipeForm.yield_unit)) {
      setActionError("Isi jumlah hasil akhir racikan dan satuannya.");
      return;
    }

    setConfirm({
      title: editingRecipe ? t("Update recipe") : t("Create recipe"),
      message: editingRecipe ? t("Update this recipe version?") : t("Create a new recipe version?"),
      confirmText: editingRecipe ? t("Update recipe") : t("Create recipe"),
      onConfirm: submitRecipeConfirmed,
    });
  }

  async function submitRecipeConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const payload = { product_id: productID, recipe_category: recipeForm.recipe_category, version: recipeForm.version.trim(), active: recipeForm.active, is_base: recipeForm.is_base, serving_quantity: recipeForm.is_base ? recipeForm.serving_quantity : "", yield_quantity: recipeForm.is_base ? recipeForm.yield_quantity : "", initial_quantity: "", yield_unit: recipeForm.is_base ? recipeForm.yield_unit : "" };
      if (editingRecipe) {
        await updateRecipe(editingRecipe.recipe_id, payload);
      } else {
        await createRecipe({ ...payload, components: recipeRows.filter(row => row.ingredient_id || row.base_recipe_id).map(row => ({ ...row })) });
      }
      setRecipeModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string; valid?: Record<string, string> }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    if (!(Number(itemForm.quantity) > 0)) { setFieldErrors({ quantity: "Quantity harus lebih dari 0" }); return; }
    if (!itemForm.recipe_id || (!itemForm.ingredient_id && !itemForm.base_recipe_id) || !itemForm.quantity) {
      setFieldErrors({
        recipe_id: !itemForm.recipe_id ? t("recipe is required") : "",
        ingredient_id: !itemForm.ingredient_id && !itemForm.base_recipe_id ? t("ingredient is required") : "",
        quantity: !itemForm.quantity ? t("quantity is required") : "",
      });
      return;
    }
    setConfirm({
      title: editingItem ? t("Update recipe item") : t("Create recipe item"),
      message: editingItem ? t("Update this recipe item?") : t("Create this recipe item?"),
      confirmText: editingItem ? t("Update item") : t("Create item"),
      onConfirm: submitItemConfirmed,
    });
  }

  async function submitItemConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateRecipeItem(editingItem.recipe_item_id, itemForm);
      } else {
        await createRecipeItem(itemForm);
      }
      setItemModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string; valid?: Record<string, string> }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || t("Action failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function requestDeleteRecipe(recipe: Recipe) {
    setConfirm({
      title: t("Delete recipe"),
      message: t("Delete this recipe version?"),
      confirmText: t("Delete recipe"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        await deleteRecipe(recipe.recipe_id);
        if (selectedRecipeID === recipe.recipe_id) setSelectedRecipeID("");
        setRefreshKey((value) => value + 1);
      },
    });
  }

  function requestToggleRecipeActive(recipe: Recipe) {
    setConfirm({
      title: recipe.active ? t("Deactivate recipe") : t("Activate recipe"),
      message: recipe.active ? t("Deactivate this recipe version?") : t("Activate this recipe version?"),
      confirmText: recipe.active ? t("Deactivate") : t("Activate"),
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await updateRecipe(recipe.recipe_id, {
            product_id: recipe.product_id,
            recipe_category: recipe.recipe_category,
            version: recipe.version,
            active: !recipe.active, is_base: recipe.is_base, serving_quantity: recipe.serving_quantity, yield_quantity: recipe.yield_quantity, initial_quantity: "", yield_unit: recipe.yield_unit,
          });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || t("Could not update recipe status."));
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDeleteItem(item: RecipeItem) {
    setConfirm({
      title: t("Delete recipe item"),
      message: t("Delete this ingredient from the recipe?"),
      confirmText: t("Delete item"),
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        await deleteRecipeItem(item.recipe_item_id);
        setRefreshKey((value) => value + 1);
      },
    });
  }

  const currentProductID = product?.product_id ?? productID;
  const backCategoryID = product?.category_id ?? categoryID;
  const hasCategoryContext = Boolean(categoryID);
  const backPath = hasCategoryContext && backCategoryID ? `/category-management/${backCategoryID}` : "/menu-items";
  const backLabel = hasCategoryContext ? product?.category_info?.name ?? t("Menu Categories") : t("Menu Items");
  const productRecipes = recipes.filter((recipe) => recipe.product_id === currentProductID);
  const activeRecipes = productRecipes.filter((recipe) => recipe.active);
  const inactiveRecipes = productRecipes.filter((recipe) => !recipe.active);
  const activeIngredients = ingredients.filter(ingredient => ingredient.active && ingredient.eligible);
  const formIngredients = activeIngredients.filter(ingredient => ingredient.recipe_category === recipeForm.recipe_category);
  const itemIngredients = activeIngredients.filter(ingredient => ingredient.recipe_category === itemCategory);
  const selectedRecipe = productRecipes.find((recipe) => recipe.recipe_id === selectedRecipeID) ?? null;

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <Link to={backPath} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={16} />
            {backLabel}
          </Link>

          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="font-serif text-3xl font-bold">{product?.name ?? t("Product Detail")}</h1>
              <p className="mt-2 text-sm text-stone-500">{product?.category_info?.name ?? t("No category")}</p>
              <p className="mt-2 text-sm text-stone-500">Untuk racikan seperti Simple Syrup, buat item menu tersendiri lalu tandai versi resepnya sebagai base.</p>
            </div>
            {userCan(user, "recipes", "create") && <button type="button" onClick={() => openRecipeModal()} className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white">
              <Plus size={17} />
              {t("Add recipe version")}
            </button>}
          </header>

          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mt-7 grid gap-5 xl:grid-cols-[330px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-200 p-4">
                  <div>
                    <h2 className="font-semibold">{t("Recipe Versions")}</h2>
                  <button type="button" disabled={loading} onClick={() => setRefreshKey(value => value + 1)} className="mt-2 text-xs font-semibold underline disabled:opacity-50">Perbarui resep</button>
                    <p className="text-xs text-stone-500">{productRecipes.length} {t("versions")}</p>
                  </div>
                  <BookOpen size={19} className="text-stone-400" />
                </div>
                <div className="divide-y divide-stone-100">
                  {loading ? (
                    <p className="p-5 text-sm text-stone-500">{t("Loading recipes...")}</p>
                  ) : productRecipes.length === 0 ? (
                    <p className="p-5 text-sm text-stone-500">{t("No recipe version yet")}</p>
                  ) : activeRecipes.length === 0 ? (
                    <p className="p-5 text-sm text-stone-500">{t("No active recipe")}</p>
                  ) : (
                    [{ label: "Resep menu", recipes: activeRecipes.filter(recipe => !recipe.is_base) }, { label: "Base racikan", recipes: activeRecipes.filter(recipe => recipe.is_base) }].filter(group => group.recipes.length > 0).map(group => (
                      <div key={group.label}><h3 className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{group.label}</h3>{group.recipes.map(recipe => (
                      <button key={recipe.recipe_id} type="button" onClick={() => setSelectedRecipeID(recipe.recipe_id)} className={`flex w-full items-center justify-between bg-white p-4 text-left hover:bg-stone-50 ${selectedRecipeID === recipe.recipe_id ? "ring-1 ring-inset ring-stone-300" : ""}`}>
                        <span>
                          <b className="block text-sm">{recipe.is_base ? "Base" : t("Version")} {recipe.version}</b>
                          <small className="text-stone-500">{recipe.recipe_category || "Kategori belum dipilih"}</small>
                        </span>
                        <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">{t("Active")}</span>
                      </button>
                      ))}</div>
                    ))
                  )}
                </div>
              </div>

              {!loading && inactiveRecipes.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="border-b border-stone-200 p-4">
                    <h2 className="font-semibold">{t("Inactive Versions")}</h2>
                    <p className="text-xs text-stone-500">{inactiveRecipes.length} {t("inactive")}</p>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {inactiveRecipes.map((recipe) => (
                      <button key={recipe.recipe_id} type="button" onClick={() => setSelectedRecipeID(recipe.recipe_id)} className={`flex w-full items-center justify-between bg-white p-4 text-left hover:bg-stone-50 ${selectedRecipeID === recipe.recipe_id ? "ring-1 ring-inset ring-stone-300" : ""}`}>
                        <span>
                          <b className="block text-sm">{recipe.is_base ? "Base" : t("Version")} {recipe.version}</b>
                          <small className="text-stone-500">{t("Inactive recipe")}</small>
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-stone-500">{t("Inactive")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">{selectedRecipe ? `${t("Version")} ${selectedRecipe.version} ${t("Recipe Items")}` : t("Recipe Items")}</h2>
                  <p className="text-xs text-stone-500">{selectedRecipe?.is_base ? (selectedRecipe.yield_quantity ? `Base · Hasil akhir ${formatQuantity(selectedRecipe.yield_quantity)} ${selectedRecipe.yield_unit}` : "Base · Hasil akhir belum dicatat") : selectedRecipe ? t("Selected recipe version") : t("Select recipe version")}</p>
                </div>
                <div className="flex gap-2">
                  {userCan(user, "recipes", "update") && selectedRecipe && <button type="button" onClick={() => openRecipeModal(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-stone-600 hover:bg-stone-50" title={t("Update recipe")}><Pencil size={16} /></button>}
                  {userCan(user, "recipes", "update") && selectedRecipe && <button type="button" onClick={() => requestToggleRecipeActive(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-stone-600 hover:bg-stone-50" title={selectedRecipe.active ? t("Deactivate recipe") : t("Activate recipe")}><Power size={16} /></button>}
                  {userCan(user, "recipes", "delete") && selectedRecipe && items.length === 0 && <button type="button" onClick={() => requestDeleteRecipe(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-red-600 hover:bg-red-50" title={t("Delete recipe")}><Trash2 size={16} /></button>}
                  {userCan(user, "recipe_items", "create") && <button type="button" onClick={() => openItemModal()} disabled={!selectedRecipeID} className="flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <ListPlus size={16} />
                    {t("Add item")}
                  </button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-150 text-left">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-5 py-3">{t("Item")}</th>
                      <th className="px-5 py-3">{t("Quantity")}</th>
                      <th className="px-5 py-3">{t("Base Unit")}</th>
                      {canWriteRecipes && <th className="px-5 py-3 text-right">{t("Action")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {itemsLoading ? (
                      <tr><td colSpan={canWriteRecipes ? 4 : 3} className="px-5 py-14 text-center text-sm text-stone-500">{t("Loading items...")}</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={canWriteRecipes ? 4 : 3} className="px-5 py-14 text-center text-sm text-stone-500">{t("No items found")}</td></tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.recipe_item_id}>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold">{item.base_recipe_info ? `${item.base_recipe_info.product_info?.name ?? "Base"} · ${item.base_recipe_info.version}` : item.ingredient_info?.name ?? "-"}</p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold">{formatQuantity(item.quantity)}</td>
                          <td className="px-5 py-4 text-sm">{item.base_recipe_info?.yield_unit ?? item.ingredient_info?.base_unit_info?.code ?? item.ingredient_info?.base_unit ?? "-"}</td>
                          {canWriteRecipes && <td className="px-5 py-4">
                            <div className="flex justify-end gap-1.5">
                              {userCan(user, "recipe_items", "update") && <button type="button" onClick={() => openItemModal(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title={t("Update item")}><Pencil size={15} /></button>}
                              {userCan(user, "recipe_items", "delete") && <button type="button" onClick={() => requestDeleteItem(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50" title={t("Delete item")}><Trash2 size={15} /></button>}
                            </div>
                          </td>}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          {selectedRecipe && <RecipeCostPanel recipeID={selectedRecipe.recipe_id} name={product?.name ?? ""} version={selectedRecipe.version} isBase={selectedRecipe.is_base ?? false} refreshKey={refreshKey} onSaveYield={userCan(user, "recipes", "update") && selectedRecipe.is_base ? async (quantity, unit) => {
 await updateRecipe(selectedRecipe.recipe_id, { product_id: selectedRecipe.product_id, recipe_category: selectedRecipe.recipe_category, version: selectedRecipe.version, active: selectedRecipe.active, is_base: true, serving_quantity: selectedRecipe.serving_quantity, yield_quantity: quantity, yield_unit: unit, initial_quantity: "" });
 setRefreshKey(value => value + 1);
 } : undefined} />}
        </main>
      </section>

      {recipeModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitRecipe} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-lg font-bold">{editingRecipe ? t("Update recipe") : t("Add recipe version")}</h2>
              <button type="button" onClick={() => setRecipeModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <div className="rounded-lg bg-stone-50 p-4"><p className="text-xs font-semibold uppercase text-stone-500">Nama menu / base</p><p className="mt-1 text-lg font-bold">{product?.name}</p></div>
              <label className="block text-sm font-semibold text-stone-700">Kategori resep<select required value={recipeForm.recipe_category} disabled={submitting} onChange={event => { setRecipeForm(current => ({ ...current, recipe_category: event.target.value })); setRecipeRows([{ ingredient_id: "", base_recipe_id: "", quantity: "" }]); }} className="mt-2 w-full rounded-lg border p-3"><option value="">Pilih kategori terlebih dahulu</option><option value="KITCHEN">KITCHEN</option><option value="BEVERAGE">BEVERAGE</option></select>{fieldErrors.recipe_category && <p className="mt-1 text-xs text-red-600">{fieldErrors.recipe_category}</p>}</label>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Version")}
                <input type="text" maxLength={100} placeholder={t("Example: Dine In or Takeaway")} value={recipeForm.version} onChange={(event) => setRecipeForm((current) => ({ ...current, version: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10" disabled={submitting} />
                <p className="mt-2 text-xs text-stone-500">{t("Each version has its own ingredients. Add cups and packaging to Takeaway only.")}</p>
                {fieldErrors.version && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.version}</p>}
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recipeForm.is_base} onChange={event => setRecipeForm(current => ({ ...current, is_base: event.target.checked }))} disabled={submitting} />Resep base racikan</label>
              {!editingRecipe ? <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Item racikan</h3><button type="button" disabled={submitting || recipeRows.length >= 100} onClick={() => setRecipeRows(rows => [...rows, { ingredient_id: "", base_recipe_id: "", quantity: "" }])} className="rounded-lg border px-3 py-2 text-sm font-semibold">+ Tambah item</button></div>
                <p className="text-xs text-stone-500">Pilih Item atau base sesuai kategori, lalu isi qty yang dipakai. Base otomatis membawa takaran menu dan HPP pemakaiannya.</p>
                {recipeForm.recipe_category && formIngredients.length === 0 && !baseRecipes.some(base => base.recipe_category === recipeForm.recipe_category) && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Belum ada item aktif untuk kategori ini. Tambahkan item di master item terlebih dahulu.</p>}
                <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="w-full min-w-[500px] table-fixed text-left text-sm"><colgroup><col /><col className="w-28" /><col className="w-20" /><col className="w-12" /></colgroup><thead className="bg-stone-50"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Satuan</th><th className="px-3 py-3"><span className="sr-only">Hapus</span></th></tr></thead><tbody>
                {recipeRows.map((row, index) => <tr key={index} className="border-t"><td className="px-3 py-3"><select aria-label={`Item ${index + 1}`} disabled={submitting || !recipeForm.recipe_category} value={row.base_recipe_id ? `base:${row.base_recipe_id}` : row.ingredient_id} onChange={event => setRecipeRows(rows => rows.map((item, i) => i === index ? { ...item, ingredient_id: event.target.value.startsWith("base:") ? "" : event.target.value, base_recipe_id: event.target.value.startsWith("base:") ? event.target.value.slice(5) : "", quantity: event.target.value.startsWith("base:") ? baseRecipes.find(base => base.recipe_id === event.target.value.slice(5))?.serving_quantity || baseRecipes.find(base => base.recipe_id === event.target.value.slice(5))?.yield_quantity || "" : "" } : item))} className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/15"><option value="">Pilih item</option><optgroup label="Item">{formIngredients.map(item => <option key={item.ingredient_id} value={item.ingredient_id}>{item.name} ({item.unit_code})</option>)}</optgroup><optgroup label="Base racikan">{baseRecipes.filter(base => base.recipe_category === recipeForm.recipe_category && Number(base.yield_quantity) > 0).map(base => <option key={base.recipe_id} value={`base:${base.recipe_id}`}>{base.product_info?.name} · {base.version}</option>)}</optgroup></select></td><td className="px-3 py-3">{row.base_recipe_id ? <span className="text-xs font-semibold">Takaran menu · {formatQuantity(row.quantity)} {baseRecipes.find(base => base.recipe_id === row.base_recipe_id)?.yield_unit}</span> : <input aria-label={`Quantity item ${index + 1}`} disabled={submitting} inputMode="decimal" placeholder="0" value={formatQuantity(row.quantity)} onChange={event => setRecipeRows(rows => rows.map((item, i) => i === index ? { ...item, quantity: normalizeNumberInput(event.target.value) } : item))} className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/15" />}</td><td className="px-3 py-3">{row.base_recipe_id ? baseRecipes.find(base => base.recipe_id === row.base_recipe_id)?.yield_unit : ingredients.find(item => item.ingredient_id === row.ingredient_id)?.unit_code ?? "—"}</td><td className="px-3 py-3"><button type="button" aria-label={`Hapus item ${index + 1}`} disabled={submitting || recipeRows.length === 1} onClick={() => setRecipeRows(rows => rows.filter((_, i) => i !== index))} className="rounded-lg p-2 text-red-600 disabled:opacity-40"><Trash2 size={16} /></button></td></tr>)}
                </tbody></table></div>
              </div> : <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Ubah item dan takarannya melalui tabel komposisi resep di halaman detail.</p>}
              {recipeForm.is_base && (
                <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                  <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-stone-800">Hasil akhir base</h3><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-stone-500">Opsional</span></div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">Jumlah base setelah selesai diolah. Contoh: 700 ml Palm Syrup.</p>
                  <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3"><p className="text-xs font-semibold text-stone-600">Total qty awal · otomatis</p><p className="mt-1 text-lg font-bold">{formatNumber(String((editingRecipe ? items : recipeRows).reduce((total, row) => {
 const unit = "recipe_item_id" in row ? row.base_recipe_info?.yield_unit || row.ingredient_info?.base_unit_info?.code : row.base_recipe_id ? baseRecipes.find(base => base.recipe_id === row.base_recipe_id)?.yield_unit : ingredients.find(item => item.ingredient_id === row.ingredient_id)?.unit_code;
 const normalized = (unit || "").toLowerCase();
 const scale = normalized === "kg" || normalized === "l" ? 1000 : normalized === "mg" ? 0.001 : 1;
 return total + (Number(row.quantity) || 0) * scale;
 }, 0)), 3)}</p><p className="mt-1 text-xs text-stone-500">Jumlah qty komposisi Item dan base. GR dan ML menjadi acuan qty gabungan; hasil akhir tetap diukur sendiri.</p></div>
                  <label className="mt-4 block text-xs font-semibold text-stone-600">Takaran base untuk satu menu<input inputMode="decimal" placeholder="Contoh: 18" value={formatQuantity(recipeForm.serving_quantity)} onChange={event => setRecipeForm(current => ({ ...current, serving_quantity: normalizeNumberInput(event.target.value) }))} className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm" disabled={submitting} /><span className="mt-1 block text-xs font-normal text-stone-500">Satuan sama dengan hasil akhir. Otomatis terbawa saat base dipilih di resep menu. Jika kosong, memakai seluruh hasil akhir.</span></label>
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <label className="block text-xs font-semibold text-stone-600">Jumlah hasil akhir
                      <input inputMode="decimal" placeholder="Contoh: 700" value={formatQuantity(recipeForm.yield_quantity)} onChange={event => setRecipeForm(current => ({ ...current, yield_quantity: normalizeNumberInput(event.target.value) }))} className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/15" disabled={submitting} />
                    </label>
                    <label className="block text-xs font-semibold text-stone-600">Satuan
                      <select value={recipeForm.yield_unit} onChange={event => setRecipeForm(current => ({ ...current, yield_unit: event.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal outline-none focus:border-[var(--color-brand-accent)] focus:ring-2 focus:ring-[var(--color-brand-accent)]/15" disabled={submitting}><option value="">Pilih</option><option value="ml">ml</option><option value="gr">gr</option></select>
                    </label>
                  </div>
                </section>
              )}
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex shrink-0 justify-end gap-3 border-t border-stone-200 bg-white px-5 py-4">
              <button type="button" onClick={() => setRecipeModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Cancel")}</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? t("Saving...") : t("Save")}</button>
            </footer>
          </form>
        </div>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitItem} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingItem ? t("Update item") : t("Add item")}</h2>
              <button type="button" onClick={() => setItemModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">Kategori item<select required value={itemCategory} disabled={submitting || Boolean(selectedRecipe?.recipe_category)} onChange={event => { const nextCategory = event.target.value;
                    setItemCategory(nextCategory);
                    setItemForm(current => {
                      const selectedCategory = current.base_recipe_id
                        ? baseRecipes.find(base => base.recipe_id === current.base_recipe_id)?.recipe_category ?? editingItem?.base_recipe_info?.recipe_category
                        : ingredients.find(ingredient => ingredient.ingredient_id === current.ingredient_id)?.recipe_category ?? (current.ingredient_id === editingItem?.ingredient_id ? itemCategory : "");
                      return selectedCategory === nextCategory ? current : { ...current, ingredient_id: "", base_recipe_id: "" };
                    }); }} className="mt-2 w-full rounded-lg border p-3"><option value="">Pilih kategori</option><option value="KITCHEN">KITCHEN</option><option value="BEVERAGE">BEVERAGE</option></select></label>
              <p className="text-xs text-stone-500">Pilih Item dan isi takarannya, atau pilih base untuk langsung menggabungkan satu racikan.</p>
              <label className="block text-sm font-semibold text-stone-700">
                {t("Item")}
                <select value={itemForm.base_recipe_id ? `base:${itemForm.base_recipe_id}` : itemForm.ingredient_id} onChange={(event) => setItemForm((current) => ({ ...current, ingredient_id: event.target.value.startsWith("base:") ? "" : event.target.value, base_recipe_id: event.target.value.startsWith("base:") ? event.target.value.slice(5) : "", quantity: event.target.value.startsWith("base:") ? baseRecipes.find(base => base.recipe_id === event.target.value.slice(5))?.serving_quantity || baseRecipes.find(base => base.recipe_id === event.target.value.slice(5))?.yield_quantity || "" : "" }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10" disabled={submitting || !itemCategory}>
                  <option value="">{t("Select item")}</option>
                  <optgroup label="Base racikan">{baseRecipes.filter(base => Number(base.yield_quantity) > 0 && base.recipe_id !== selectedRecipeID && base.recipe_category === itemCategory).map(base => <option key={base.recipe_id} value={`base:${base.recipe_id}`}>{base.product_info?.name ?? base.product_id} · {base.version} {base.yield_unit ? `(${base.yield_unit})` : ""}</option>)}</optgroup>
                  {editingItem && (editingItem.ingredient_id || editingItem.base_recipe_id) && <option value={editingItem.base_recipe_id ? `base:${editingItem.base_recipe_id}` : editingItem.ingredient_id}>{editingItem.ingredient_info?.name ?? editingItem.base_recipe_info?.product_info?.name ?? "Item saat ini"} (pilihan saat ini)</option>}
                  {itemIngredients.map((ingredient) => (
                    <option key={ingredient.ingredient_id} value={ingredient.ingredient_id} disabled={!ingredient.active}>{ingredient.name} ({ingredient.unit_code})</option>
                  ))}
                </select>
                {fieldErrors.ingredient_id && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.ingredient_id}</p>}
              </label>
              {itemForm.base_recipe_id ? <div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="text-sm font-semibold">Takaran base untuk menu · otomatis</p><p className="mt-1 text-sm text-stone-600">Pemakaian {formatQuantity(baseRecipes.find(base => base.recipe_id === itemForm.base_recipe_id)?.serving_quantity || baseRecipes.find(base => base.recipe_id === itemForm.base_recipe_id)?.yield_quantity || "")} {baseRecipes.find(base => base.recipe_id === itemForm.base_recipe_id)?.yield_unit}. HPP base ÷ hasil akhir × takaran menu.</p></div> : <label className="block text-sm font-semibold text-stone-700">
                {t("Quantity")} {itemForm.base_recipe_id ? `(${baseRecipes.find(base => base.recipe_id === itemForm.base_recipe_id)?.yield_unit ?? editingItem?.base_recipe_info?.yield_unit ?? ""})` : `(${ingredients.find(ingredient => ingredient.ingredient_id === itemForm.ingredient_id)?.unit_code ?? editingItem?.ingredient_info?.base_unit_info?.code ?? ""})`}
                <input inputMode="decimal" placeholder="0" value={formatQuantity(itemForm.quantity)} onChange={(event) => setItemForm((current) => ({ ...current, quantity: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10" disabled={submitting} />
                {fieldErrors.quantity && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.quantity}</p>}
              </label>}
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setItemModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">{t("Cancel")}</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? t("Saving...") : t("Save")}</button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? t("Confirm")} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
