import {
  KeyRound,
  Pencil,
  Power,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import {
  deleteUser,
  checkUserDelete,
  getUsers,
  updateUser,
  updateUserActive,
  updateUserPassword,
} from "../../api/user.api";
import {
  createUserRole,
  deleteUserRole,
  getUserRoles,
  type UserRole,
} from "../../api/userRole.api";
import { getRoles, type Role } from "../../api/role.api";
import { useAuth } from "../../app/AuthContext";
import { useLanguage } from "../../app/LanguageContext";
import { userCan } from "../../app/roleAccess";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import UserFormModal from "../../components/user/UserFormModal";
import type { UpdateUserRequest, User } from "../../types/user";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
type ActionMode = "edit" | "password" | "active" | "delete";
type ActionFieldErrors = Record<string, string | undefined>;
type ConfirmRequest = {
  title: string;
  message: string;
  confirmText: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

const emptyEditForm: UpdateUserRequest = {
  fullname: "",
  email: "",
  phone: "",
  address: "",
  position: "",
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const canCreateUsers = userCan(currentUser, "users", "create");
  const canUpdateUsers = userCan(currentUser, "users", "update");
  const canDeleteUsers = userCan(currentUser, "users", "delete");
  const showUserActions = canUpdateUsers || canDeleteUsers;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionError, setActionError] = useState("");
  const [deleteReasons, setDeleteReasons] = useState<Record<string, string>>({});
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState("");
  const [actionFieldErrors, setActionFieldErrors] =
    useState<ActionFieldErrors>({});
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rolesUser, setRolesUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIDs, setSelectedRoleIDs] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSubmitting, setRolesSubmitting] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );

  useEffect(() => {
    let current = true;
    async function loadUsers() {
      setLoading(true);
      setDeleteReasons({});
      setError("");
      try {
        const response = await getUsers({
          start: (page - 1) * pageSize,
          limit: pageSize,
          fullname: search,
        });
        if (!current) return;
        const nextUsers = response.data ?? [];
        setUsers(nextUsers);
        setTotal(response.total ?? 0);
        if (canDeleteUsers) {
          const checks = await Promise.all(nextUsers.map(async (user) => {
            if (user.user_id === currentUser?.user_id) {
              return [user.user_id, "Cannot delete your own account"] as const;
            }
            try {
              await checkUserDelete(user.user_id);
              return [user.user_id, ""] as const;
            } catch (error) {
              const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
              return [user.user_id, message || "Could not verify whether this user can be deleted. Please try again."] as const;
            }
          }));
          if (current) setDeleteReasons(Object.fromEntries(checks));
        }
      } catch (requestError) {
        if (current) {
          setUsers([]);
          const message = isAxiosError<{ message?: string }>(requestError)
            ? requestError.response?.data?.message
            : undefined;
          setError(
            message ||
              t("Could not connect to the user service. Please try again."),
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
  }, [page, pageSize, search, refreshKey, canDeleteUsers, currentUser?.user_id]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function refreshUsers() {
    setRefreshKey((value) => value + 1);
  }

  async function requestDelete(user: User) {
    if (checkingDelete) return;
    if (user.user_id === currentUser?.user_id) {
      setDeleteBlockedReason(t("Cannot delete your own account"));
      return;
    }
    setCheckingDelete(true);
    try {
      await checkUserDelete(user.user_id);
      openAction("delete", user);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
      setDeleteBlockedReason(t(message || "Could not verify whether this user can be deleted. Please try again."));
    } finally {
      setCheckingDelete(false);
    }
  }

  function openAction(mode: ActionMode, user: User) {
    if (mode === "active" && user.active && user.is_admin) return;
    setActionUser(user);
    setActionMode(mode);
    setActionError("");
    setActionFieldErrors({});
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEditForm({
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      address: user.address,
      position: user.position,
    });
  }

  async function openRoles(user: User) {
    setRolesUser(user);
    setRoles([]);
    setAvailableRoles([]);
    setSelectedRoleIDs([]);
    setRolesError("");
    setRolesLoading(true);
    try {
      const [userRolesResponse, rolesResponse] = await Promise.all([
        getUserRoles(user.user_id),
        getRoles(),
      ]);
      setRoles(userRolesResponse.data ?? []);
      setAvailableRoles(rolesResponse.data ?? []);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setRolesError(response?.message || t("Could not load user roles."));
    } finally {
      setRolesLoading(false);
    }
  }

  function toggleSelectedRole(roleID: string) {
    setSelectedRoleIDs((current) =>
      current.includes(roleID)
        ? current.filter((id) => id !== roleID)
        : [...current, roleID],
    );
  }

  async function refreshRolePopup(userID: string) {
    const [userRolesResponse, rolesResponse] = await Promise.all([
      getUserRoles(userID),
      getRoles(),
    ]);
    setRoles(userRolesResponse.data ?? []);
    setAvailableRoles(rolesResponse.data ?? []);
    setSelectedRoleIDs([]);
    refreshUsers();
  }

  async function addSelectedRoles() {
    if (!rolesUser || selectedRoleIDs.length === 0) return;
    setConfirmRequest({
      title: t("Add roles"),
      message: t("Add the selected roles to this user?"),
      confirmText: t("Add roles"),
      onConfirm: addSelectedRolesConfirmed,
    });
  }

  async function addSelectedRolesConfirmed() {
    if (!rolesUser || selectedRoleIDs.length === 0) return;
    setConfirmRequest(null);
    setRolesError("");
    setRolesSubmitting(true);
    try {
      await Promise.all(
        selectedRoleIDs.map((roleID) =>
          createUserRole(rolesUser.user_id, roleID),
        ),
      );
      await refreshRolePopup(rolesUser.user_id);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setRolesError(response?.message || t("Could not add selected roles."));
    } finally {
      setRolesSubmitting(false);
    }
  }

  async function removeUserRole(roleID: string) {
    if (!rolesUser) return;
    setConfirmRequest({
      title: t("Delete role"),
      message: t("Remove this role from the user?"),
      confirmText: t("Delete role"),
      tone: "danger",
      onConfirm: () => removeUserRoleConfirmed(roleID),
    });
  }

  async function removeUserRoleConfirmed(roleID: string) {
    if (!rolesUser) return;
    setConfirmRequest(null);
    setRolesError("");
    setRolesSubmitting(true);
    try {
      await deleteUserRole(rolesUser.user_id, roleID);
      await refreshRolePopup(rolesUser.user_id);
    } catch (requestError) {
      const response = isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data
        : undefined;
      setRolesError(response?.message || t("Could not delete role."));
    } finally {
      setRolesSubmitting(false);
    }
  }

  function closeAction() {
    if (actionSubmitting) return;
    setActionUser(null);
    setActionMode(null);
  }

  function fieldError(name: string) {
    if (name === "current_password") {
      return actionFieldErrors.current_password || actionFieldErrors.currentpassword;
    }
    return actionFieldErrors[name];
  }

  function inputClass(name: string) {
    return `mt-2 w-full rounded-lg border px-3.5 py-3 text-sm outline-none ${fieldError(name) ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" : "border-stone-300 focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"}`;
  }

  function clearFieldError(name: string) {
    setActionFieldErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === "current_password" ? { currentpassword: undefined } : {}),
    }));
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!actionUser || !actionMode) return;
    setActionError("");
    setActionFieldErrors({});
    if (actionMode === "password" && newPassword !== confirmPassword) {
      setActionFieldErrors({
        confirm_password: t("Confirm password must match password"),
      });
      return;
    }
    setConfirmRequest({
      title:
        actionMode === "edit"
          ? t("Update user")
          : actionMode === "password"
            ? t("Change password")
            : actionMode === "active"
              ? actionUser.active
                ? t("Deactivate user")
                : t("Activate user")
              : t("Delete user"),
      message:
        actionMode === "edit"
          ? t("Update this user data?")
          : actionMode === "password"
            ? t("Change this user password?")
            : actionMode === "active"
              ? actionUser.active
                ? t("Deactivate this user account?")
                : t("Activate this user account?")
              : t("Delete this user permanently?"),
      confirmText:
        actionMode === "edit"
          ? t("Update")
          : actionMode === "password"
            ? t("Change password")
            : actionMode === "active"
              ? actionUser.active
                ? t("Deactivate")
                : t("Activate")
              : t("Delete user"),
      tone: actionMode === "delete" ? "danger" : "default",
      onConfirm: submitActionConfirmed,
    });
  }

  async function submitActionConfirmed() {
    if (!actionUser || !actionMode) return;
    setConfirmRequest(null);
    setActionSubmitting(true);
    try {
      if (actionMode === "edit") {
        await updateUser(actionUser.user_id, editForm);
      }
      if (actionMode === "password") {
        await updateUserPassword(actionUser.user_id, {
          current_password: currentPassword,
          password: newPassword,
          confirm_password: confirmPassword,
        });
      }
      if (actionMode === "active") {
        await updateUserActive(actionUser.user_id, {
          current_password: currentPassword,
          active: !actionUser.active,
        });
      }
      if (actionMode === "delete") {
        await deleteUser(actionUser.user_id);
      }
      closeAction();
      refreshUsers();
    } catch (requestError) {
      const response = isAxiosError<{
        message?: string;
        valid?: Record<string, string>;
      }>(requestError)
        ? requestError.response?.data
        : undefined;
      if (actionMode === "delete" && isAxiosError(requestError) && requestError.response?.status === 409) {
        setActionUser(null);
        setActionMode(null);
        setDeleteBlockedReason(t(response?.message || "Action failed. Please try again."));
        return;
      }
      setActionFieldErrors(response?.valid ?? {});
      setActionError(
        response?.valid
          ? ""
          : response?.message || t("Action failed. Please try again."),
      );
    } finally {
      setActionSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const assignedRoleIDs = new Set(roles.map((role) => role.role_id));
  const addableRoles = availableRoles.filter(
    (role) => !assignedRoleIDs.has(role.role_id),
  );
  return (
    <div className="flex min-h-screen bg-[var(--color-brand-cream)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-accent)]">
                <UserCog size={22} />
              </div>
              <h1 className="font-serif text-3xl font-bold">{t("User Management")}</h1>
              <p className="mt-2 text-sm text-stone-500">
                {t("Manage people who have access to C.R.E.M.A.")}
              </p>
            </div>
            {canCreateUsers && (
              <button
                onClick={() => setFormOpen(true)}
                className="rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-semibold text-white"
              >
                + {t("Add user")}
              </button>
            )}
          </header>

          <section className="mt-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t("All users")}</h2>
                <p className="text-xs text-stone-500">
                  {total} {t("registered users")}
                </p>
              </div>
              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 focus-within:border-[var(--color-brand-accent)] focus-within:ring-4 focus-within:ring-[var(--color-brand-accent)]/10"
              >
                <Search size={17} className="text-stone-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder={t("Search by name...")}
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
                    <th className="px-5 py-3">{t("User")}</th>
                    <th className="px-5 py-3">{t("Contact")}</th>
                    <th className="px-5 py-3">{t("Position")}</th>
                    <th className="px-5 py-3">{t("Status")}</th>
                    {showUserActions && (
                      <th className="px-5 py-3 text-right">{t("Action")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={showUserActions ? 5 : 4}
                        className="px-5 py-14 text-center text-sm text-stone-500"
                      >
                        <span className="mx-auto mb-3 block size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[var(--color-brand-accent)]" />
                        {t("Loading users...")}
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showUserActions ? 5 : 4}
                        className="px-5 py-14 text-center"
                      >
                        <Users className="mx-auto mb-3 text-stone-300" />
                        <p className="font-semibold">{t("No users found")}</p>
                        <p className="text-sm text-stone-500">
                          {t("Try another search keyword.")}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isCurrentUser = user.user_id === currentUser?.user_id;
                      return (
                        <tr key={user.user_id} className="hover:bg-stone-50/70">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-soft)] text-xs font-bold text-[var(--color-brand-accent)]">
                                {user.fullname.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <p className="text-sm font-semibold">
                                  {user.fullname}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm">{user.email}</p>
                            <p className="text-xs text-stone-500">
                              {user.phone}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            {user.position}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${user.active ? "bg-green-500" : "bg-stone-400"}`}
                              />
                              {user.active ? t("Active") : t("Inactive")}
                            </span>
                          </td>
                          {showUserActions && (
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1.5">
                              {canUpdateUsers && (
                                <button
                                  type="button"
                                  onClick={() => openRoles(user)}
                                  className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                  title={t("Manage roles")}
                                >
                                  <Shield size={15} />
                                </button>
                              )}
                              {canUpdateUsers && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openAction("edit", user)}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                    title={t("Update data")}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAction("password", user)}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                                    title={t("Change password")}
                                  >
                                    <KeyRound size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAction("active", user)}
                                    disabled={isCurrentUser || Boolean(user.active && user.is_admin)}
                                    className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                    title={
                                      isCurrentUser
                                        ? t("Cannot change your own account status")
                                        : user.active && user.is_admin
                                          ? "User Admin tidak bisa dinonaktifkan"
                                          : user.active
                                          ? t("Deactivate user")
                                          : t("Activate user")
                                    }
                                  >
                                    <Power size={15} />
                                  </button>
                                </>
                              )}
                              {canDeleteUsers && (
                                <span tabIndex={deleteReasons[user.user_id] ? 0 : undefined} title={t(deleteReasons[user.user_id] || "Delete user")}>
                                <button
                                  type="button"
                                  onClick={() => void requestDelete(user)}
                                  disabled={checkingDelete || isCurrentUser || deleteReasons[user.user_id] !== ""}
                                  className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                  title={
                                    isCurrentUser
                                      ? t("Cannot delete your own account")
                                      : t(deleteReasons[user.user_id] || "Delete user")
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                                </span>
                              )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-stone-500">
                  {t("Page")} {page} {t("of")} {totalPages}
                </p>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                  {t("Limit")}
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPage(1);
                      setPageSize(Number(event.target.value));
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 outline-none focus:border-[var(--color-brand-accent)] focus:ring-4 focus:ring-[var(--color-brand-accent)]/10"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {t("Previous")}
                </button>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {t("Next")}
                </button>
              </div>
            </footer>
          </section>
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
            <ShieldCheck size={15} />
            {t("Only Admin and HRIS Admin can access this page.")}
          </div>
        </main>
      </section>
      {formOpen && (
        <UserFormModal
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            setPage(1);
            refreshUsers();
          }}
        />
      )}
      {actionUser && actionMode && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitAction}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">
                  {actionMode === "edit" && t("Update data")}
                  {actionMode === "password" && t("Change password")}
                  {actionMode === "active" &&
                    (actionUser.active ? t("Deactivate user") : t("Activate user"))}
                  {actionMode === "delete" && t("Delete user")}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {actionUser.fullname}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAction}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              {actionMode === "edit" && (
                <>
                  {(["fullname", "email", "phone", "position"] as const).map(
                    (field) => (
                      <label
                        key={field}
                        className="block text-sm font-semibold text-stone-700"
                      >
                        {field === "fullname"
                          ? t("Full name")
                          : field === "email"
                            ? t("Email address")
                            : field === "phone"
                              ? t("Phone number")
                              : t("Position")}
                        <input
                          value={editForm[field]}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          onInput={() => clearFieldError(field)}
                          className={inputClass(field)}
                          disabled={actionSubmitting}
                        />
                        {fieldError(field) && (
                          <p className="mt-1.5 text-xs font-medium text-red-600">
                            {fieldError(field)}
                          </p>
                        )}
                      </label>
                    ),
                  )}
                  <label className="block text-sm font-semibold text-stone-700">
                    {t("Address")}
                    <textarea
                      value={editForm.address}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      onInput={() => clearFieldError("address")}
                      className={`${inputClass("address")} min-h-24 resize-y`}
                      disabled={actionSubmitting}
                    />
                    {fieldError("address") && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {fieldError("address")}
                      </p>
                    )}
                  </label>
                </>
              )}
              {(actionMode === "password" || actionMode === "active") && (
                <label className="block text-sm font-semibold text-stone-700">
                  {t("Current password")}
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      clearFieldError("current_password");
                    }}
                    className={inputClass("current_password")}
                    disabled={actionSubmitting}
                  />
                  {fieldError("current_password") && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      {fieldError("current_password")}
                    </p>
                  )}
                </label>
              )}
              {actionMode === "password" && (
                <>
                  <label className="block text-sm font-semibold text-stone-700">
                    {t("New password")}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        clearFieldError("password");
                      }}
                      className={inputClass("password")}
                      disabled={actionSubmitting}
                    />
                    {fieldError("password") && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {fieldError("password")}
                      </p>
                    )}
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    {t("Confirm password")}
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        clearFieldError("confirm_password");
                      }}
                      className={inputClass("confirm_password")}
                      disabled={actionSubmitting}
                    />
                    {fieldError("confirm_password") && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {fieldError("confirm_password")}
                      </p>
                    )}
                  </label>
                </>
              )}
              {actionMode === "delete" && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {t("Delete this user permanently?")}
                </p>
              )}
              {actionError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              <button
                type="button"
                onClick={closeAction}
                disabled={actionSubmitting}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${actionMode === "delete" ? "bg-red-700" : "bg-[var(--color-brand-primary)]"}`}
              >
                {actionSubmitting ? t("Saving...") : t("Save")}
              </button>
            </footer>
          </form>
        </div>
      )}
      {deleteBlockedReason && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-blocked-title" aria-describedby="delete-blocked-reason">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="delete-blocked-title" className="text-lg font-bold">{t("Cannot delete user")}</h2>
            <p id="delete-blocked-reason" className="mt-3 text-sm text-stone-600">{deleteBlockedReason}</p>
            <button type="button" disabled className="mt-6 mr-3 cursor-not-allowed rounded-lg bg-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-400">{t("Delete user")}</button>
            <button autoFocus type="button" onClick={() => setDeleteBlockedReason("")} className="mt-6 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white">{t("Close")}</button>
          </section>
        </div>
      )}
      {rolesUser && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <section className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h2 className="text-lg font-bold">{t("User roles")}</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {rolesUser.fullname}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRolesUser(null)}
                className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto p-5">
              {rolesLoading ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  <span className="mx-auto mb-3 block size-5 animate-spin rounded-full border-2 border-stone-200 border-t-[var(--color-brand-accent)]" />
                  {t("Loading roles...")}
                </div>
              ) : rolesError ? (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {rolesError}
                </p>
              ) : (
                <>
                  <section>
                    <h3 className="text-sm font-bold text-stone-800">
                      {t("Assigned roles")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {roles.length === 0 ? (
                        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                          {t("This user does not have any roles.")}
                        </p>
                      ) : (
                        roles.map((role) => (
                          <div
                            key={`${role.user_id}-${role.role_id}`}
                            className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {role.role_name || t("Unnamed role")}
                              </p>
                            </div>
                            {canUpdateUsers && (
                              <button
                                type="button"
                                onClick={() => removeUserRole(role.role_id)}
                                disabled={rolesSubmitting}
                                className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
                                title={t("Delete role from user")}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {canUpdateUsers && (
                    <section>
                      <h3 className="text-sm font-bold text-stone-800">
                        {t("Add roles")}
                      </h3>
                      <div className="mt-3 space-y-2">
                        {addableRoles.length === 0 ? (
                          <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
                            {t("All roles are already assigned.")}
                          </p>
                        ) : (
                          addableRoles.map((role) => (
                            <label
                              key={role.role_id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 px-3.5 py-3 hover:bg-stone-50"
                            >
                              <input
                                type="checkbox"
                                checked={selectedRoleIDs.includes(role.role_id)}
                                onChange={() => toggleSelectedRole(role.role_id)}
                                disabled={rolesSubmitting}
                                className="size-4 accent-[var(--color-brand-accent)]"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-stone-800">
                                  {role.name}
                                </span>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-stone-200 p-5">
              {canUpdateUsers && (
                <button
                  type="button"
                  onClick={addSelectedRoles}
                  disabled={
                    rolesLoading ||
                    rolesSubmitting ||
                    selectedRoleIDs.length === 0
                  }
                  className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {rolesSubmitting ? t("Saving...") : t("Add selected")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setRolesUser(null)}
                disabled={rolesSubmitting}
                className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
              >
                {t("Close")}
              </button>
            </footer>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmRequest)}
        title={confirmRequest?.title ?? ""}
        message={confirmRequest?.message ?? ""}
        confirmText={confirmRequest?.confirmText ?? t("Confirm")}
        tone={confirmRequest?.tone}
        submitting={actionSubmitting || rolesSubmitting}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => {
          void confirmRequest?.onConfirm();
        }}
      />
    </div>
  );
}
