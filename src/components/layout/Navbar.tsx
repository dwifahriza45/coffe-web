import { Bell, LogOut, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout as logoutRequest } from "../../api/auth.api";
import { useAuth } from "../../app/AuthContext";
import { invalidateSession } from "../../app/authSession";

export default function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, setUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initials = user?.fullname?.slice(0, 2).toUpperCase() || "CR";

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  async function handleLogout() {
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
      <header className="relative z-30 h-19 border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex h-full min-w-0 items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white lg:hidden"
            onClick={onMenuClick}
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 outline-none transition hover:border-[#d6a287] hover:text-[#9d5935] focus:ring-4 focus:ring-[#b86b42]/10"
            >
              <Bell size={19} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#c45f32] ring-2 ring-white" />
            </button>
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
                aria-label="Open account menu"
                className="flex h-10 max-w-52 items-center gap-2 rounded-xl bg-white py-1 pl-1 pr-3 outline-none ring-1 ring-stone-200 transition hover:ring-[#d6a287] focus:ring-4 focus:ring-[#b86b42]/10"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#b86b42] text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden min-w-0 truncate text-sm font-semibold text-stone-800 sm:block">
                  {user?.fullname || "C.R.E.M.A"}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+.75rem)] z-40 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_18px_45px_rgba(54,34,25,.16)]">
                  <div className="flex items-center gap-3 border-b border-stone-100 px-2 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2e2d8] text-xs font-bold text-[#92502f]">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-stone-900">
                        {user?.fullname}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileOpen(true);
                    }}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    <UserRound size={17} />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <LogOut size={17} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {profileOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <span className="grid size-14 place-items-center rounded-full bg-[#b86b42] text-lg font-bold text-white">
                {initials}
              </span>
              <button
                type="button"
                aria-label="Close profile"
                onClick={() => setProfileOpen(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={19} />
              </button>
            </div>
            <h2 className="mt-4 text-xl font-bold">{user?.fullname}</h2>
            <p className="text-sm text-stone-500">
              {user?.position || "Team Member"}
            </p>
            <dl className="mt-5 space-y-3 border-t pt-5 text-sm">
              <div>
                <dt className="text-xs text-stone-400">Email</dt>
                <dd className="mt-1 font-medium">{user?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Phone</dt>
                <dd className="mt-1 font-medium">{user?.phone || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {logoutOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="navbar-logout-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <span className="grid size-12 place-items-center rounded-xl bg-orange-50 text-[#9d5935]">
              <LogOut size={22} />
            </span>
            <h2 id="navbar-logout-title" className="mt-5 text-xl font-bold">
              Confirm logout?
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              You’ll need to sign in again to access the C.R.E.M.A dashboard.
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                disabled={isLoggingOut}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-sm font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="flex flex-1 items-center justify-center rounded-lg bg-[#a94732] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
