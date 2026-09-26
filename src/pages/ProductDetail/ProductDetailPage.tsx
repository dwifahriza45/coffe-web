import { ArrowLeft, BookOpen, ListPlus, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { isAxiosError } from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getIngredients, type Ingredient } from "../../api/ingredient.api";
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
  createRecipe,
  deleteRecipe,
  getRecipes,
  updateRecipe,
  type Recipe,
} from "../../api/recipe.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";
import { formatNumber, normalizeNumberInput } from "../../utils/numberFormat";

const emptyRecipeForm = { product_id: "", version: "", active: true };
const emptyItemForm: RecipeItemPayload = { recipe_id: "", ingredient_id: "", quantity: "" };

function formatQuantity(value: string) {
  return formatNumber(value, 6);
}

export default function ProductDetailPage() {
  const { user } = useAuth();
  const roles = getUserRoleNames(user);
  const canWriteRecipes = roles.includes("admin");
  const { categoryID = "", productID = "" } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeID, setSelectedRecipeID] = useState("");
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState("");
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);
  const [recipeForm, setRecipeForm] = useState(emptyRecipeForm);
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
      setSelectedRecipeID("");
      setItems([]);
      try {
        const [productResponse, recipeResponse, ingredientResponse] = await Promise.all([
          getProduct(productID),
          getRecipes({ start: 0, limit: 100, name: "", product_id: productID }),
          canWriteRecipes ? getIngredients({ start: 0, limit: 100, name: "" }) : Promise.resolve({ data: [] }),
        ]);
        if (!current) return;
        const nextProduct = productResponse.data ?? null;
        const currentProductID = nextProduct?.product_id ?? productID;
        const nextRecipes = (recipeResponse.data ?? []).filter((recipe) => recipe.product_id === currentProductID);
        setProduct(nextProduct);
        setRecipes(nextRecipes);
        setIngredients(ingredientResponse.data ?? []);
        setSelectedRecipeID((currentID) => {
          const currentRecipe = nextRecipes.find((recipe) => recipe.recipe_id === currentID);
          if (currentRecipe?.active) return currentID;
          return nextRecipes.find((recipe) => recipe.active)?.recipe_id ?? nextRecipes[0]?.recipe_id ?? "";
        });
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setError(response?.message || "Could not load product detail.");
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
        setError(response?.message || "Could not load recipe items.");
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
    setRecipeForm(recipe ? { product_id: productID, version: String(recipe.version), active: recipe.active } : { ...emptyRecipeForm, product_id: productID });
    setFieldErrors({});
    setActionError("");
    setRecipeModalOpen(true);
  }

  function openItemModal(item?: RecipeItem) {
    setEditingItem(item ?? null);
    setItemForm(item ? { recipe_id: item.recipe_id, ingredient_id: item.ingredient_id, quantity: item.quantity } : { ...emptyItemForm, recipe_id: selectedRecipeID });
    setFieldErrors({});
    setActionError("");
    setItemModalOpen(true);
  }

  function submitRecipe(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    if (!recipeForm.version) {
      setFieldErrors({ version: "version is required" });
      return;
    }
    setConfirm({
      title: editingRecipe ? "Update recipe" : "Create recipe",
      message: editingRecipe ? "Update this recipe version?" : "Create a new recipe version?",
      confirmText: editingRecipe ? "Update recipe" : "Create recipe",
      onConfirm: submitRecipeConfirmed,
    });
  }

  async function submitRecipeConfirmed() {
    setConfirm(null);
    setSubmitting(true);
    try {
      const payload = { product_id: productID, version: Number(recipeForm.version), active: recipeForm.active };
      if (editingRecipe) {
        await updateRecipe(editingRecipe.recipe_id, payload);
      } else {
        await createRecipe(payload);
      }
      setRecipeModalOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string; valid?: Record<string, string> }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldErrors(response?.valid ?? {});
      setActionError(response?.valid ? "" : response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    if (!itemForm.recipe_id || !itemForm.ingredient_id || !itemForm.quantity) {
      setFieldErrors({
        recipe_id: !itemForm.recipe_id ? "recipe is required" : "",
        ingredient_id: !itemForm.ingredient_id ? "ingredient is required" : "",
        quantity: !itemForm.quantity ? "quantity is required" : "",
      });
      return;
    }
    setConfirm({
      title: editingItem ? "Update recipe item" : "Create recipe item",
      message: editingItem ? "Update this recipe item?" : "Create this recipe item?",
      confirmText: editingItem ? "Update item" : "Create item",
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
      setActionError(response?.valid ? "" : response?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDeleteRecipe(recipe: Recipe) {
    setConfirm({
      title: "Delete recipe",
      message: "Delete this recipe version?",
      confirmText: "Delete recipe",
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
      title: recipe.active ? "Deactivate recipe" : "Activate recipe",
      message: recipe.active ? "Deactivate this recipe version?" : "Activate this recipe version?",
      confirmText: recipe.active ? "Deactivate" : "Activate",
      onConfirm: async () => {
        setConfirm(null);
        setSubmitting(true);
        try {
          await updateRecipe(recipe.recipe_id, {
            product_id: recipe.product_id,
            version: recipe.version,
            active: !recipe.active,
          });
          setRefreshKey((value) => value + 1);
        } catch (requestError) {
          const response = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data
            : undefined;
          setError(response?.message || "Could not update recipe status.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  function requestDeleteItem(item: RecipeItem) {
    setConfirm({
      title: "Delete recipe item",
      message: "Delete this ingredient from the recipe?",
      confirmText: "Delete item",
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
  const backLabel = hasCategoryContext ? product?.category_info?.name ?? "Menu Categories" : "Menu Items";
  const productRecipes = recipes.filter((recipe) => recipe.product_id === currentProductID);
  const activeRecipes = productRecipes.filter((recipe) => recipe.active);
  const inactiveRecipes = productRecipes.filter((recipe) => !recipe.active);
  const selectedRecipe = productRecipes.find((recipe) => recipe.recipe_id === selectedRecipeID) ?? null;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
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
              <h1 className="font-serif text-3xl font-bold">{product?.name ?? "Product Detail"}</h1>
              <p className="mt-2 text-sm text-stone-500">{product?.category_info?.name ?? "No category"}</p>
            </div>
            {canWriteRecipes && <button type="button" onClick={() => openRecipeModal()} className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white">
              <Plus size={17} />
              Add recipe version
            </button>}
          </header>

          {error && <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mt-7 grid gap-5 xl:grid-cols-[330px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-200 p-4">
                  <div>
                    <h2 className="font-semibold">Recipe Versions</h2>
                    <p className="text-xs text-stone-500">{productRecipes.length} versions</p>
                  </div>
                  <BookOpen size={19} className="text-stone-400" />
                </div>
                <div className="divide-y divide-stone-100">
                  {loading ? (
                    <p className="p-5 text-sm text-stone-500">Loading recipes...</p>
                  ) : productRecipes.length === 0 ? (
                    <p className="p-5 text-sm text-stone-500">No recipe version yet</p>
                  ) : activeRecipes.length === 0 ? (
                    <p className="p-5 text-sm text-stone-500">No active recipe</p>
                  ) : (
                    activeRecipes.map((recipe) => (
                      <button key={recipe.recipe_id} type="button" onClick={() => setSelectedRecipeID(recipe.recipe_id)} className={`flex w-full items-center justify-between bg-white p-4 text-left hover:bg-stone-50 ${selectedRecipeID === recipe.recipe_id ? "ring-1 ring-inset ring-stone-300" : ""}`}>
                        <span>
                          <b className="block text-sm">Version {recipe.version}</b>
                          <small className="text-stone-500">Active recipe</small>
                        </span>
                        <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">Active</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {!loading && inactiveRecipes.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="border-b border-stone-200 p-4">
                    <h2 className="font-semibold">Inactive Versions</h2>
                    <p className="text-xs text-stone-500">{inactiveRecipes.length} inactive</p>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {inactiveRecipes.map((recipe) => (
                      <button key={recipe.recipe_id} type="button" onClick={() => setSelectedRecipeID(recipe.recipe_id)} className={`flex w-full items-center justify-between bg-white p-4 text-left hover:bg-stone-50 ${selectedRecipeID === recipe.recipe_id ? "ring-1 ring-inset ring-stone-300" : ""}`}>
                        <span>
                          <b className="block text-sm">Version {recipe.version}</b>
                          <small className="text-stone-500">Inactive recipe</small>
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-stone-500">Inactive</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">{selectedRecipe ? `Version ${selectedRecipe.version} Items` : "Recipe Items"}</h2>
                  <p className="text-xs text-stone-500">{selectedRecipe ? "Selected recipe version" : "Select recipe version"}</p>
                </div>
                <div className="flex gap-2">
                  {canWriteRecipes && selectedRecipe && <button type="button" onClick={() => openRecipeModal(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-stone-600 hover:bg-stone-50" title="Update recipe"><Pencil size={16} /></button>}
                  {canWriteRecipes && selectedRecipe && <button type="button" onClick={() => requestToggleRecipeActive(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-stone-600 hover:bg-stone-50" title={selectedRecipe.active ? "Deactivate recipe" : "Activate recipe"}><Power size={16} /></button>}
                  {canWriteRecipes && selectedRecipe && items.length === 0 && <button type="button" onClick={() => requestDeleteRecipe(selectedRecipe)} className="grid size-9 place-items-center rounded-lg border text-red-600 hover:bg-red-50" title="Delete recipe"><Trash2 size={16} /></button>}
                  {canWriteRecipes && <button type="button" onClick={() => openItemModal()} disabled={!selectedRecipeID} className="flex items-center gap-2 rounded-lg bg-[#362219] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <ListPlus size={16} />
                    Add item
                  </button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-150 text-left">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-5 py-3">Ingredient</th>
                      <th className="px-5 py-3">Quantity</th>
                      <th className="px-5 py-3">Base Unit</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {itemsLoading ? (
                      <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">Loading items...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-stone-500">No items found</td></tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.recipe_item_id}>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold">{item.ingredient_info?.name ?? "-"}</p>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold">{formatQuantity(item.quantity)}</td>
                          <td className="px-5 py-4 text-sm">{item.ingredient_info?.base_unit_info?.code ?? item.ingredient_info?.base_unit ?? "-"}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1.5">
                              {canWriteRecipes && <button type="button" onClick={() => openItemModal(item)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title="Update item"><Pencil size={15} /></button>}
                              {canWriteRecipes && <button type="button" onClick={() => requestDeleteItem(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50" title="Delete item"><Trash2 size={15} /></button>}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </section>

      {recipeModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitRecipe} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingRecipe ? "Update recipe" : "Add recipe version"}</h2>
              <button type="button" onClick={() => setRecipeModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Version
                <input inputMode="numeric" placeholder="Enter version" value={formatNumber(recipeForm.version, 0)} onChange={(event) => setRecipeForm((current) => ({ ...current, version: normalizeNumberInput(event.target.value, false) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.version && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.version}</p>}
              </label>
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setRecipeModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button>
            </footer>
          </form>
        </div>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitItem} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <h2 className="text-lg font-bold">{editingItem ? "Update item" : "Add item"}</h2>
              <button type="button" onClick={() => setItemModalOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Ingredient
                <select value={itemForm.ingredient_id} onChange={(event) => setItemForm((current) => ({ ...current, ingredient_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting}>
                  <option value="">Select ingredient</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.ingredient_id} value={ingredient.ingredient_id} disabled={!ingredient.active}>{ingredient.name}{ingredient.active ? "" : " - Inactive"}</option>
                  ))}
                </select>
                {fieldErrors.ingredient_id && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.ingredient_id}</p>}
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Quantity
                <input inputMode="decimal" placeholder="0" value={formatQuantity(itemForm.quantity)} onChange={(event) => setItemForm((current) => ({ ...current, quantity: normalizeNumberInput(event.target.value) }))} className="mt-2 w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10" disabled={submitting} />
                {fieldErrors.quantity && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.quantity}</p>}
              </label>
              {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button type="button" onClick={() => setItemModalOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button>
            </footer>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmText={confirm?.confirmText ?? "Confirm"} tone={confirm?.tone} submitting={submitting} onCancel={() => setConfirm(null)} onConfirm={() => void confirm?.onConfirm()} />
    </div>
  );
}
