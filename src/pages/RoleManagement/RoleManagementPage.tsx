import {
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
  type Role,
} from "../../api/role.api";
import { getUsers } from "../../api/user.api";
import {
  createUserRole,
  deleteUserRole,
  getRoleUsers,
  type UserRole,
} from "../../api/userRole.api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import type { User } from "../../types/user";

type RoleMode = "create" | "edit";
type ConfirmRequest = {
  title: string;
  message: string;
  confirmText: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

export default function RoleManagementPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleUsage, setRoleUsage] = useState<Record<string, boolean>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<RoleMode | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [usersRole, setUsersRole] = useState<Role | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<UserRole[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIDs, setSelectedUserIDs] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSubmitting, setUsersSubmitting] = useState(false);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    let current = true;
    async function loadRoles() {
      setLoading(true);
      setError("");
      try {
        const response = await getRoles(search);
        if (!current) return;
        const nextRoles = response.data ?? [];
        setRoles(nextRoles);
        const usageEntries = await Promise.all(
          nextRoles.map(async (role) => {
            const usage = await getRoleUsers(role.role_id);
            return [role.role_id, Boolean(usage.data?.length)] as const;
          }),
        );
        if (!current) return;
        setRoleUsage(Object.fromEntries(usageEntries));
      } catch (requestError) {
        if (!current) return;
        const response = isAxiosError<{ message?: string }>(requestError)
          ? requestError.response?.data
          : undefined;
        setRoles([]);
        setRoleUsage({});
        setError(response?.message || "Could not load roles.");
      } finally {
        if (current) setLoading(false);
      }
    }
    void loadRoles();
    return () => {
      current = false;
    };
  }, [search, refreshKey]);

  function refreshRoles() {
    setRefreshKey((value) => value + 1);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function openRoleModal(mode: RoleMode, role?: Role) {
    setModalMode(mode);
    setActiveRole(role ?? null);
    setRoleName(role?.name ?? "");
    setFieldError("");
    setActionError("");
  }

  function closeRoleModal() {
    if (submitting) return;
    setModalMode(null);
    setActiveRole(null);
  }

  async function submitRole(event: FormEvent) {
    event.preventDefault();
    setFieldError("");
    setActionError("");
    if (roleName.trim().length < 3) {
      setFieldError("name must be at least 3 characters");
      return;
    }
    setConfirmRequest({
      title: modalMode === "create" ? "Create role" : "Update role",
      message:
        modalMode === "create"
          ? "Create this role?"
          : "Update this role name?",
      confirmText: modalMode === "create" ? "Create role" : "Update role",
      onConfirm: submitRoleConfirmed,
    });
  }

  async function submitRoleConfirmed() {
    if (!modalMode) return;
    setConfirmRequest(null);
    setSubmitting(true);
    try {
      if (modalMode === "create") {
        await createRole(roleName);
      } else if (activeRole) {
        await updateRole(activeRole.role_id, roleName);
      }
      closeRoleModal();
      refreshRoles();
    } catch (requestError) {
      const response = isAxiosError<{
        message?: string;
        valid?: Record<string, string>;
      }>(requestError)
        ? requestError.response?.data
        : undefined;
      setFieldError(response?.valid?.name ?? "");
      setActionError(
        response?.valid ? "" : response?.message || "Action failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(role: Role) {
    setConfirmRequest({
      title: "Delete role",
      message: "Delete this role permanently?",
      confirmText: "Delete role",
      tone: "danger",
      onConfirm: () => deleteRoleConfirmed(role.role_id),
    });
  }

  async function deleteRoleConfirmed(roleID: string) {
    setConfirmRequest(null);
    setSubmitting(true);
    try {
      await deleteRole(roleID);
      refreshRoles();
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(response?.message || "Could not delete role.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openUsers(role: Role) {
    setUsersRole(role);
    setAssignedUsers([]);
    setAllUsers([]);
    setSelectedUserIDs([]);
    setUsersError("");
    setUsersLoading(true);
    try {
      const [roleUsersResponse, usersResponse] = await Promise.all([
        getRoleUsers(role.role_id),
        getUsers({ start: 0, limit: 100, fullname: "" }),
      ]);
      setAssignedUsers(roleUsersResponse.data ?? []);
      setAllUsers(usersResponse.data ?? []);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setUsersError(response?.message || "Could not load assigned users.");
    } finally {
      setUsersLoading(false);
    }
  }

  function toggleSelectedUser(userID: string) {
    setSelectedUserIDs((current) =>
      current.includes(userID)
        ? current.filter((id) => id !== userID)
        : [...current, userID],
    );
  }

  async function refreshUsersPopup(roleID: string) {
    const [roleUsersResponse, usersResponse] = await Promise.all([
      getRoleUsers(roleID),
      getUsers({ start: 0, limit: 100, fullname: "" }),
    ]);
    setAssignedUsers(roleUsersResponse.data ?? []);
    setAllUsers(usersResponse.data ?? []);
    setSelectedUserIDs([]);
    refreshRoles();
  }

  function requestAddSelectedUsers() {
    if (!usersRole || selectedUserIDs.length === 0) return;
    setConfirmRequest({
      title: "Add users",
      message: "Assign the selected users to this role?",
      confirmText: "Add users",
      onConfirm: addSelectedUsersConfirmed,
    });
  }

  async function addSelectedUsersConfirmed() {
    if (!usersRole || selectedUserIDs.length === 0) return;
    setConfirmRequest(null);
    setUsersError("");
    setUsersSubmitting(true);
    try {
      await Promise.all(
        selectedUserIDs.map((userID) =>
          createUserRole(userID, usersRole.role_id),
        ),
      );
      await refreshUsersPopup(usersRole.role_id);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setUsersError(response?.message || "Could not assign selected users.");
    } finally {
      setUsersSubmitting(false);
    }
  }

  function requestRemoveUser(userID: string) {
    if (!usersRole) return;
    setConfirmRequest({
      title: "Remove user",
      message: "Remove this user from the role?",
      confirmText: "Remove user",
      tone: "danger",
      onConfirm: () => removeUserConfirmed(userID),
    });
  }

  async function removeUserConfirmed(userID: string) {
    if (!usersRole) return;
    setConfirmRequest(null);
    setUsersError("");
    setUsersSubmitting(true);
    try {
      await deleteUserRole(userID, usersRole.role_id);
      await refreshUsersPopup(usersRole.role_id);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setUsersError(response?.message || "Could not remove user from role.");
    } finally {
      setUsersSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
                <Shield size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">Role Management</h1>
              <p className="mt-2 text-sm text-stone-500">
                Manage access roles and review assigned users.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openRoleModal("create")}
              className="flex items-center gap-2 rounded-lg bg-[#362219] px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              Add role
            </button>
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">All roles</h2>
                <p className="text-xs text-stone-500">
                  {roles.length} roles found
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
                  placeholder="Search role..."
                />
              </form>
            </div>
            {error && (
              <div className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 text-left">
                <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Usage</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        <span className="mx-auto mb-3 block size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[#92502f]" />
                        Loading roles...
                      </td>
                    </tr>
                  ) : roles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-14 text-center">
                        <Shield className="mx-auto mb-3 text-stone-300" />
                        <p className="font-semibold">No roles found</p>
                      </td>
                    </tr>
                  ) : (
                    roles.map((role) => {
                      const hasUsers = Boolean(roleUsage[role.role_id]);
                      return (
                        <tr key={role.role_id} className="hover:bg-stone-50/70">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 place-items-center rounded-lg bg-[#f2e2d8] text-[#92502f]">
                                <Shield size={17} />
                              </span>
                              <div>
                                <p className="text-sm font-semibold">
                                  {role.name}
                                </p>
                                <p className="text-xs text-stone-400">
                                  {role.role_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${hasUsers ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${hasUsers ? "bg-amber-500" : "bg-stone-400"}`}
                              />
                              {hasUsers ? "Assigned" : "Unused"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openUsers(role)}
                                className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                title="View users"
                              >
                                <Users size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openRoleModal("edit", role)}
                                className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                title="Update role"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(role)}
                                disabled={hasUsers}
                                className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                title={
                                  hasUsers ? "Have assigned users" : "Delete role"
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
            <ShieldCheck size={15} />
            Only Admin and HRIS Admin can access this page.
          </div>
        </main>
      </section>

      {modalMode && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitRole}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">
                  {modalMode === "create" ? "Add role" : "Update role"}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {modalMode === "create"
                    ? "Create a new access role."
                    : activeRole?.role_id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRoleModal}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-stone-700">
                Role name
                <input
                  value={roleName}
                  onChange={(event) => {
                    setRoleName(event.target.value);
                    setFieldError("");
                  }}
                  className={`mt-2 w-full rounded-lg border px-3.5 py-3 text-sm outline-none ${fieldError ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" : "border-stone-300 focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"}`}
                  disabled={submitting}
                />
                {fieldError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {fieldError}
                  </p>
                )}
              </label>
              {actionError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={closeRoleModal}
                disabled={submitting}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {usersRole && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <section className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">Assigned users</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {usersRole.name} · {usersRole.role_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUsersRole(null)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto p-5">
              {usersLoading ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  <span className="mx-auto mb-3 block size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[#92502f]" />
                  Loading users...
                </div>
              ) : usersError ? (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {usersError}
                </p>
              ) : (
                <>
                  <section>
                    <h3 className="text-sm font-bold text-stone-800">
                      Assigned users
                    </h3>
                    <div className="mt-3 space-y-2">
                      {assignedUsers.length === 0 ? (
                        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                          This role is not assigned to any users.
                        </p>
                      ) : (
                        assignedUsers.map((item) => (
                          <div
                            key={`${item.user_id}-${item.role_id}`}
                            className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {item.fullname || item.user_id}
                              </p>
                              <p className="text-xs text-stone-400">
                                {item.user_id}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestRemoveUser(item.user_id)}
                              disabled={usersSubmitting}
                              className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                              title="Remove user from role"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-stone-800">
                      Add users
                    </h3>
                    <div className="mt-3 space-y-2">
                      {allUsers.filter(
                        (user) =>
                          !assignedUsers.some(
                            (assigned) => assigned.user_id === user.user_id,
                          ),
                      ).length === 0 ? (
                        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                          All users are already assigned.
                        </p>
                      ) : (
                        allUsers
                          .filter(
                            (user) =>
                              !assignedUsers.some(
                                (assigned) =>
                                  assigned.user_id === user.user_id,
                              ),
                          )
                          .map((user) => (
                            <label
                              key={user.user_id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 px-3.5 py-3 hover:bg-stone-50"
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIDs.includes(
                                  user.user_id,
                                )}
                                onChange={() =>
                                  toggleSelectedUser(user.user_id)
                                }
                                disabled={usersSubmitting}
                                className="size-4 accent-[#92502f]"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-stone-800">
                                  {user.fullname}
                                </span>
                                <span className="block text-xs text-stone-400">
                                  {user.user_id}
                                </span>
                              </span>
                            </label>
                          ))
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={requestAddSelectedUsers}
                disabled={
                  usersLoading ||
                  usersSubmitting ||
                  selectedUserIDs.length === 0
                }
                className="rounded-lg bg-[#362219] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {usersSubmitting ? "Saving..." : "Add selected"}
              </button>
              <button
                type="button"
                onClick={() => setUsersRole(null)}
                disabled={usersSubmitting}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmRequest)}
        title={confirmRequest?.title ?? ""}
        message={confirmRequest?.message ?? ""}
        confirmText={confirmRequest?.confirmText ?? "Confirm"}
        tone={confirmRequest?.tone}
        submitting={submitting || usersSubmitting}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => {
          void confirmRequest?.onConfirm();
        }}
      />
    </div>
  );
}
