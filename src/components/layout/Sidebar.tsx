import {
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  CalendarDays,
  CupSoda,
  FolderTree,
  PackageOpen,
  Ruler,
  Shield,
  UserCog,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { logout as logoutRequest } from "../../api/auth.api";
import { useAuth } from "../../app/AuthContext";
import { invalidateSession } from "../../app/authSession";
import { getUserRoleNames } from "../../app/roleAccess";
import Brand from "./Brand";
export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, setUser } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const roles = getUserRoleNames(user);
  const isAdmin = roles.includes("admin");
  const canManageUsers = roles.some((role) =>
    ["admin", "hris_admin"].includes(role),
  );
  const canReadStockMaster = roles.some((role) =>
    ["admin", "inventory"].includes(role),
  );
  const canReadMenuCategories = roles.some((role) =>
    ["admin", "ballista", "leader"].includes(role),
  );
  const canReadProducts = roles.some((role) =>
    ["admin", "ballista", "leader"].includes(role),
  );
  const canManageBusinessDays = roles.some((role) =>
    ["admin", "leader"].includes(role),
  );
  const links: Array<{
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
  }> = [];
  const hrisLinks: Array<{
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
  }> = [];
  const inventoryMasterLinks: Array<{
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
  }> = [];
  const inventoryMenuLinks: Array<{
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
  }> = [];
  if (isAdmin) {
    links.push({ label: "Overview", to: "/dashboard", icon: LayoutDashboard });
  }
  if (canManageBusinessDays) {
    links.push({ label: "Business Days", to: "/business-days", icon: CalendarDays });
  }
  if (canManageUsers)
    hrisLinks.push({
      label: "User Management",
      to: "/user-management",
      icon: UserCog,
    });
  if (canManageUsers)
    hrisLinks.push({
      label: "Role Management",
      to: "/role-management",
      icon: Shield,
    });
  if (canReadStockMaster)
    inventoryMasterLinks.push({
      label: "Unit Management",
      to: "/unit-management",
      icon: Ruler,
    });
  if (canReadStockMaster)
    inventoryMasterLinks.push({
      label: "Ingredient Management",
      to: "/ingredient-management",
      icon: PackageOpen,
    });
  if (canReadMenuCategories)
    inventoryMenuLinks.push({
      label: "Menu Items",
      to: "/category-management",
      icon: FolderTree,
    });
  if (canReadProducts && !canReadMenuCategories)
    inventoryMenuLinks.push({
      label: "Menu Items",
      to: "/menu-items",
      icon: CupSoda,
    });
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
        aria-label="Close menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden ${isOpen ? "" : "hidden"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col bg-[#211712] p-6 transition-transform duration-300 lg:sticky lg:top-0 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Brand />
        <nav className="mt-12 space-y-2">
          {links.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {hrisLinks.length > 0 && (
            <div className="pt-5">
              <div className="mb-3 flex items-center gap-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                  HRIS
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="space-y-2">
                {hrisLinks.map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={label}
                    to={to}
                    onClick={onClose}
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
          {(inventoryMasterLinks.length > 0 || inventoryMenuLinks.length > 0) && (
            <div className="pt-5">
              {inventoryMasterLinks.length > 0 && (
                <>
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                      Master Data
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    {inventoryMasterLinks.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg p-3 text-sm ${isActive ? "bg-[#4b3023] text-white" : "text-stone-300 hover:bg-white/5"}`
                        }
                      >
                        <Icon size={18} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
              {inventoryMenuLinks.length > 0 && (
                <div className="pt-5">
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
                      Menu
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    {inventoryMenuLinks.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={label}
                        to={to}
                        onClick={onClose}
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
        </nav>
        {links.length === 0 &&
          hrisLinks.length === 0 &&
          inventoryMasterLinks.length === 0 &&
          inventoryMenuLinks.length === 0 && (
          <div className="relative flex flex-1 items-center justify-center">
            <span className="absolute h-36 w-36 rounded-full bg-[#b86b42]/20 blur-2xl" />
            <span className="relative grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/5 text-stone-500 backdrop-blur-md">
              <LockKeyhole size={42} strokeWidth={1.6} />
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center gap-2 border-t border-white/15 pt-5 text-stone-300">
          <span className="grid size-9 place-items-center rounded-full bg-[#b86b42] text-xs text-white">
            {user?.fullname?.slice(0, 2).toUpperCase() || "KR"}
          </span>
          <span className="flex flex-1 flex-col">
            <b className="text-xs text-white">
              {user?.fullname || "C.R.E.M.A"}
            </b>
            <small>{user?.position || "Team Member"}</small>
          </span>
          <button
            aria-label="Logout"
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
              Confirm logout?
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              You’ll need to sign in again to access the C.R.E.M.A dashboard.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={isLoggingOut}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#a94732] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#8f3929] disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
