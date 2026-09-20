import { Search, ShieldCheck, UserCog, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { getUsers } from "../../api/user.api";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import UserFormModal from "../../components/user/UserFormModal";
import type { User } from "../../types/user";

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let current = true;
    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const response = await getUsers({
          start: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          fullname: search,
        });
        if (!current) return;
        setUsers(response.data ?? []);
        setTotal(response.total ?? 0);
      } catch (requestError) {
        if (current) {
          setUsers([]);
          const message = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data?.message
            : undefined;
          setError(
            message ||
              "Could not connect to the user service. Please try again.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadUsers();
    return () => {
      current = false;
    };
  }, [page, search, refreshKey]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <UserCog size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">User Management</h1>
              <p className="mt-2 text-sm text-stone-500">
                Manage people who have access to C.R.E.M.A.
              </p>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              + Add user
            </button>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">All users</h2>
                <p className="text-xs text-stone-500">
                  {total} registered users
                </p>
              </div>
              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[#b86b42] focus-within:ring-4 focus-within:ring-[#b86b42]/10"
              >
                <Search size={17} className="text-stone-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Search by name..."
                />
              </form>
            </div>

            {error && (
              <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Position</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        <span className="mx-auto mb-3 block size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[#92502f]" />
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center">
                        <Users className="mx-auto mb-3 text-stone-300" />
                        <p className="font-semibold">No users found</p>
                        <p className="text-sm text-stone-500">
                          Try another search keyword.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.user_id} className="hover:bg-stone-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f2e2d8] text-xs font-bold text-[#92502f]">
                              {user.fullname.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-sm font-semibold">
                                {user.fullname}
                              </p>
                              <p className="text-xs text-stone-400">
                                {user.user_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm">{user.email}</p>
                          <p className="text-xs text-stone-500">{user.phone}</p>
                        </td>
                        <td className="px-5 py-4 text-sm">{user.position}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${user.active ? "bg-green-500" : "bg-stone-400"}`}
                            />
                            {user.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <p className="text-xs text-stone-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </footer>
          </section>
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
            <ShieldCheck size={15} />
            Only Admin and HRIS Admin can access this page.
          </div>
        </main>
      </section>
      {formOpen && (
        <UserFormModal
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            setPage(1);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
