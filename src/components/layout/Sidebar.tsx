import {
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  CupSoda,
  FolderTree,
  PackageOpen,
  Tags,
  Ruler,
  Truck,
  Shield,
  Search,
  Scale,
  X,
  UserCog,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef, useState } from "react";
import { logout as logoutRequest } from "../../api/auth.api";
import { useAuth } from "../../app/AuthContext";
import { invalidateSession } from "../../app/authSession";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import Brand from "./Brand";

type SidebarLink = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
};

const SIDEBAR_SCROLL_KEY = "crema-sidebar-scroll";

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [menuSearch, setMenuSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const canReadDashboard = userCan(user, "dashboard");
  const canReadUsers = userCan(user, "users");
  const canReadRoles = userCan(user, "roles");
  const canReadBusinessDays = userCan(user, "business_days");
  const canReadInventoryCounts = userCan(user, "inventory_counts");
  const canReadOpeningCounts =
    userCan(user, "inventory_opening_counts");
  const canReadStockReceipts = userCan(user, "stock_receipts");
  const canReadStockAdjustments = userCan(user, "stock_adjustments");
  const canReadStockMovements = userCan(user, "stock_movements");
  const canReadCurrentStock = userCan(user, "current_stock");
  const canReadReconciliations = userCan(user, "reconciliations");
  const canReadClosingCounts =
    userCan(user, "inventory_closing_counts");
  const canReadUnits = userCan(user, "units");
  const canReadIngredients = userCan(user, "ingredients");
  const canReadBrandTypes = userCan(user, "brand_types");
  const canReadSuppliers = userCan(user, "suppliers");
  const canReadCategories = userCan(user, "categories");
  const canReadProducts = userCan(user, "products");
  const links: SidebarLink[] = [];
  const hrisLinks: SidebarLink[] = [];
  const inventoryMasterLinks: SidebarLink[] = [];
  const inventoryOperationLinks: SidebarLink[] = [];
  const stockOpnameChildLinks: SidebarLink[] = [];
  const inventoryMenuLinks: SidebarLink[] = [];
  const activeParams = new URLSearchParams(location.search);
  const activeStockDate = activeParams.get("date") ?? "";
  const activeBusinessDayID =
    activeParams.get("businessDayID") ??
    location.pathname.match(/^\/business-days\/([^/]+)\/inventory-counts/)?.[1] ??
    "";
  const stockOpnameContextQuery =
    activeBusinessDayID || activeStockDate
      ? `?${new URLSearchParams({
          ...(activeBusinessDayID ? { businessDayID: activeBusinessDayID } : {}),
          ...(activeStockDate ? { date: activeStockDate } : {}),
        })}`
      : "";
  const stockCountOpeningPath = `/stock-count/opening${stockOpnameContextQuery}`;
  const stockCountClosingPath = `/stock-count/closing${stockOpnameContextQuery}`;
  if (canReadDashboard) {
    links.push({ label: t("Overview"), to: "/dashboard", icon: LayoutDashboard });
  }
  if (canReadBusinessDays) {
    links.push({ label: t("Business Days"), to: "/business-days", icon: CalendarDays });
  }
  if (canReadUsers)
    hrisLinks.push({
      label: t("User Management"),
      to: "/user-management",
      icon: UserCog,
    });
  if (canReadRoles)
    hrisLinks.push({
      label: t("Role Management"),
      to: "/role-management",
      icon: Shield,
    });
  if (canReadUnits)
    inventoryMasterLinks.push({
      label: t("Content unit"),
      to: "/unit-management",
      icon: Ruler,
    });
  if (userCan(user, "packagings"))
    inventoryMasterLinks.push({ label: t("Packaging unit"), to: "/packaging-management", icon: PackageOpen });
  if (userCan(user, "category_ingredient"))
    inventoryMasterLinks.push({ label: t("Ingredient Categories"), to: "/category-ingredient-management", icon: FolderTree });
  if (canReadBrandTypes)
    inventoryMasterLinks.push({
      label: t("Brand / Type"),
      to: "/brand-type-management",
      icon: Tags,
    });
  if (canReadSuppliers)
    inventoryMasterLinks.push({ label: t("Suppliers"), to: "/supplier-management", icon: Truck });
  if (canReadIngredients)
    inventoryMasterLinks.push({
      label: t("Ingredients"),
      to: "/ingredient-management",
      icon: PackageOpen,
    });
  if (canReadInventoryCounts)
    inventoryOperationLinks.push({
      label: t("Stock Count"),
      to: `/stock-count${stockOpnameContextQuery}`,
      icon: ClipboardCheck,
    });
  if (canReadCurrentStock)
    inventoryOperationLinks.push({
      label: t("Current Stock"),
      to: "/current-stock",
      icon: Boxes,
    });
  if (canReadStockReceipts)
    inventoryOperationLinks.push({
      label: t("Purchasing"),
      to: "/stock-in",
      icon: Truck,
    });
  if (canReadReconciliations)
    inventoryOperationLinks.push({
      label: t("Reconciliation"),
      to: "/reconciliation",
      icon: Scale,
    });
  if (canReadOpeningCounts)
    stockOpnameChildLinks.push({
      label: t("Opening Stock"),
      to: stockCountOpeningPath,
      icon: ClipboardCheck,
    });
  if (canReadStockAdjustments)
    stockOpnameChildLinks.push({
      label: t("Stock Adjustments"),
      to: `/stock-adjustments${stockOpnameContextQuery}`,
      icon: ClipboardCheck,
    });
  if (canReadStockMovements)
    stockOpnameChildLinks.push({
      label: t("Stock Movements"),
      to: `/stock-movements${stockOpnameContextQuery}`,
      icon: PackageOpen,
    });
  if (canReadClosingCounts)
    stockOpnameChildLinks.push({
      label: t("Closing Stock"),
      to: stockCountClosingPath,
      icon: ClipboardCheck,
    });
  if (canReadCategories)
    inventoryMenuLinks.push({
      label: t("Menu Items"),
      to: "/category-management",
      icon: FolderTree,
    });
  if (canReadProducts && !canReadCategories)
    inventoryMenuLinks.push({
      label: t("Menu Items"),
      to: "/menu-items",
      icon: CupSoda,
    });
  const searchTerms = menuSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
  function matchesMenu(label: string, group: string) {
    const text = `${group} ${label}`.toLowerCase();
    return searchTerms.every((term) => text.includes(term));
  }
  const filteredLinks = links.filter((link) => matchesMenu(link.label, ""));
  const filteredHrisLinks = hrisLinks.filter((link) => matchesMenu(link.label, "HRIS"));
  const filteredInventoryMasterLinks = inventoryMasterLinks.filter((link) => matchesMenu(link.label, t("Master Data")));
  const filteredInventoryOperationLinks = inventoryOperationLinks.filter((link) => matchesMenu(link.label, t("Inventory")));
  const filteredStandaloneInventoryOperationLinks =
    filteredInventoryOperationLinks.filter(
      (link) => link.to.split("?")[0] !== "/stock-count",
    );
  const filteredStockOpnameChildLinks = stockOpnameChildLinks.filter((link) => matchesMenu(link.label, `${t("Inventory")} ${t("Stock Count")}`));
  const filteredInventoryMenuLinks = inventoryMenuLinks.filter((link) => matchesMenu(link.label, t("Menu")));
  const showStockOpnameGroup =
    filteredInventoryOperationLinks.length > 0 ||
    filteredStockOpnameChildLinks.length > 0;
  const stockOpnameLink = filteredInventoryOperationLinks.find(
    (link) => link.to.split("?")[0] === "/stock-count",
  );
  const hasMenus = [links, hrisLinks, inventoryMasterLinks, inventoryOperationLinks, stockOpnameChildLinks, inventoryMenuLinks].some((group) => group.length > 0);
  const resultCount = [filteredLinks, filteredHrisLinks, filteredInventoryMasterLinks, filteredInventoryOperationLinks, filteredStockOpnameChildLinks, filteredInventoryMenuLinks].reduce((total, group) => total + group.length, 0);
  const StockOpnameIcon = stockOpnameLink?.icon;

  useLayoutEffect(() => {
    if (menuSearch) return;
    const savedScroll = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? 0);
    if (navRef.current) {
      navRef.current.scrollTop = Number.isFinite(savedScroll) ? savedScroll : 0;
    }
  }, []);

  function rememberScroll() {
    if (!navRef.current) return;
    window.sessionStorage.setItem(
      SIDEBAR_SCROLL_KEY,
      String(navRef.current.scrollTop),
    );
  }

  function isStockChildActive(to: string, pathActive: boolean) {
    const path = to.split("?")[0];
    const focus = path === "/stock-count/opening" ? "opening" : path === "/stock-count/closing" ? "closing" : null;
    return focus
      ? pathActive || ((location.pathname.startsWith("/stock-count/") || location.pathname.includes("/inventory-counts/")) && activeParams.get("focus") === focus)
      : pathActive;
  }
  async function logout() {
    setIsLoggingOut(true);
    try {
      await logoutRequest();
    } catch {
      /* The local session must still end if the API is unavailable. */
    }
    invalidateSession();
    setUser(null);
    window.location.replace("/login");
  }
  return (
    <>
      <button
        aria-label={t("Close menu")}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden ${isOpen ? "" : "hidden"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[calc(100vw-2rem)] shrink-0 flex-col bg-[#211712] p-6 transition-transform duration-300 lg:sticky lg:top-0 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Brand />
        {hasMenus && (
          <div role="search" aria-label={t("Search sidebar menus")} className="mt-7 flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-stone-400 transition focus-within:border-[#b86b42] focus-within:ring-2 focus-within:ring-[#b86b42]/20">
            <Search size={16} className="shrink-0" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label={t("Search menus")}
              placeholder={t("Search menus...")}
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setMenuSearch("");
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-500"
            />
            {menuSearch && (
              <button type="button" aria-label={t("Clear menu search")} onClick={() => { setMenuSearch(""); searchInputRef.current?.focus(); }} className="grid size-6 shrink-0 place-items-center rounded text-stone-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#b86b42]">
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <nav
          ref={navRef}
          aria-label={t("Main navigation")}
          onScroll={rememberScroll}
          className="sidebar-scroll mt-4 -mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pb-5 pr-2"
        >
          {filteredLinks.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              onClick={() => {
                rememberScroll();
                onClose();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {(filteredInventoryMasterLinks.length > 0 || showStockOpnameGroup || filteredInventoryMenuLinks.length > 0) && (
            <div className="pt-5">
              {showStockOpnameGroup && (
                <div>
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                      {t("Inventory")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    {stockOpnameLink && StockOpnameIcon && (
                      <NavLink
                        key={stockOpnameLink.label}
                        to={stockOpnameLink.to}
                        onClick={() => {
                          rememberScroll();
                          onClose();
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                        }
                      >
                        <StockOpnameIcon size={18} />
                        {stockOpnameLink.label}
                      </NavLink>
                    )}
                    {filteredStockOpnameChildLinks.length > 0 && (
                      <div className="ml-5 space-y-1 border-l border-white/10 pl-3">
                        {filteredStockOpnameChildLinks.map(({ label, to, icon: Icon }) => (
                          <NavLink
                            key={label}
                            to={to}
                            onClick={() => {
                              rememberScroll();
                              onClose();
                            }}
                            className={({ isActive }) =>
                              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isStockChildActive(to, isActive) ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                            }
                          >
                            <Icon size={16} />
                            {label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                    {filteredStandaloneInventoryOperationLinks.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        onClick={() => {
                          rememberScroll();
                          onClose();
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                        }
                      >
                        <Icon size={18} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
              {filteredInventoryMenuLinks.length > 0 && (
                <div className="pt-5">
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                      {t("Menu")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    {filteredInventoryMenuLinks.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        onClick={() => {
                          rememberScroll();
                          onClose();
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                        }
                      >
                        <Icon size={18} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
              {filteredInventoryMasterLinks.length > 0 && (
                <div className="pt-5">
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                      {t("Master Data")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    {filteredInventoryMasterLinks.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        onClick={() => {
                          rememberScroll();
                          onClose();
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                        }
                      >
                        <Icon size={18} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {filteredHrisLinks.length > 0 && (
            <div className="pt-5">
              <div className="mb-3 flex items-center gap-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                  HRIS
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="space-y-2">
                {filteredHrisLinks.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={label}
                    to={to}
                    onClick={() => {
                      rememberScroll();
                      onClose();
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          {hasMenus && resultCount === 0 && (
            <div role="status" className="rounded-xl border border-white/10 bg-white/5 px-3 py-6 text-center">
              <Search size={22} className="mx-auto mb-3 text-stone-500" />
              <p className="text-sm font-medium text-stone-300">{t("No menus found")}</p>
              <p className="mt-1 text-xs text-stone-400">{t("Try another keyword.")}</p>
            </div>
          )}
        </nav>
        {links.length === 0 &&
          hrisLinks.length === 0 &&
          inventoryMasterLinks.length === 0 &&
          inventoryOperationLinks.length === 0 &&
          stockOpnameChildLinks.length === 0 &&
          inventoryMenuLinks.length === 0 && (
          <div className="relative flex flex-1 items-center justify-center">
            <span className="absolute h-36 w-36 rounded-full bg-[#b86b42]/20 blur-2xl" />
            <span className="relative grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/5 text-stone-500 backdrop-blur-md">
              <LockKeyhole size={42} strokeWidth={1.6} />
            </span>
          </div>
        )}
        <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-white/15 pt-5 text-stone-300">
          <span className="grid size-9 place-items-center rounded-full bg-[#b86b42] text-xs text-white">
            {user?.fullname?.slice(0, 2).toUpperCase() || "KR"}
          </span>
          <span className="flex flex-1 flex-col">
            <b className="text-xs text-white">
              {user?.fullname || "C.R.E.M.A"}
            </b>
            <small>{user?.position || t("Team Member")}</small>
          </span>
          <button
            aria-label={t("Logout")}
            onClick={() => setShowLogoutConfirm(true)}
            className="grid size-9 place-items-center rounded-lg transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid size-12 place-items-center rounded-xl bg-orange-50 text-[#9d5935]">
              <LogOut size={22} />
            </span>
            <h2
              id="logout-title"
              className="mt-5 text-xl font-bold text-stone-900"
            >
              {t("Confirm logout?")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t("You’ll need to sign in again to access the C.R.E.M.A dashboard.")}
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={isLoggingOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#a94732] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#8f3929] disabled:opacity-60"
              >
                {isLoggingOut ? t("Logging out...") : t("Logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
