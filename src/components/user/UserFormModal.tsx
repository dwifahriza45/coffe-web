import { isAxiosError } from "axios";
import { Eye, EyeOff, UserPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createUser } from "../../api/user.api";
import ConfirmDialog from "../common/ConfirmDialog";
import type { ApiResponse } from "../../types/auth";
import type { CreateUserRequest } from "../../types/user";

type FieldErrors = Partial<Record<keyof CreateUserRequest, string>>;
const initialForm: CreateUserRequest = {
  fullname: "",
  email: "",
  phone: "",
  address: "",
  position: "",
  password: "",
  confirm_password: "",
};

export default function UserFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function update(field: keyof CreateUserRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (form.fullname.trim().length < 3)
      next.fullname = "Fullname must be at least 3 characters";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      next.email = "Enter a valid email address";
    if (!form.phone.trim()) next.phone = "Phone is required";
    if (form.address.trim().length < 3)
      next.address = "Address must be at least 3 characters";
    if (form.position.trim().length < 2)
      next.position = "Position must be at least 2 characters";
    if (form.password.length < 8)
      next.password = "Password must be at least 8 characters";
    if (form.confirm_password !== form.password)
      next.confirm_password = "Confirm password must match password";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setConfirmOpen(true);
  }

  async function createConfirmedUser() {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const response = await createUser(form);
      if (response.error) {
        setErrors((response.valid ?? {}) as FieldErrors);
        setError(response.valid ? "" : response.message);
        return;
      }
      onCreated();
    } catch (requestError) {
      const response = isAxiosError<ApiResponse<null>>(requestError)
        ? requestError.response?.data
        : undefined;
      setErrors((response?.valid ?? {}) as FieldErrors);
      setError(
        response?.valid
          ? ""
          : response?.message || "Could not create user. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: keyof CreateUserRequest) =>
    `mt-2 w-full rounded-lg border bg-white px-3.5 py-3 text-sm outline-none transition disabled:bg-stone-100 ${errors[field] ? "border-red-400 focus:ring-4 focus:ring-red-100" : "border-stone-300 focus:border-[#b86b42] focus:ring-4 focus:ring-[#b86b42]/10"}`;
  const field = (
    name: keyof CreateUserRequest,
    label: string,
    type = "text",
    placeholder = "",
  ) => (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <input
        type={type}
        value={form[name]}
        onChange={(event) => update(name, event.target.value)}
        className={inputClass(name)}
        placeholder={placeholder}
        disabled={submitting}
      />
      {errors[name] && (
        <p className="mt-1.5 text-xs font-medium text-red-600">
          {errors[name]}
        </p>
      )}
    </label>
  );
  const passwordField = (
    name: "password" | "confirm_password",
    label: string,
    placeholder: string,
  ) => (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <span className="relative mt-2 block">
        <input
          type={showPassword ? "text" : "password"}
          value={form[name]}
          onChange={(event) => update(name, event.target.value)}
          className={`${inputClass(name)} mt-0 pr-11`}
          placeholder={placeholder}
          disabled={submitting}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {errors[name] && (
        <p className="mt-1.5 text-xs font-medium text-red-600">
          {errors[name]}
        </p>
      )}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-title"
    >
      <form
        onSubmit={submit}
        className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-stone-200 p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#f2e2d8] text-[#92502f]">
              <UserPlus size={21} />
            </span>
            <div>
              <h2 id="add-user-title" className="text-xl font-bold">
                Add new user
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Create an account and provide their workspace details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"
          >
            <X size={19} />
          </button>
        </header>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {field("fullname", "Full name", "text", "Muhammad Dwi Fahriza")}
            {field("email", "Email address", "email", "name@crema.id")}
            {field("phone", "Phone number", "tel", "08xxxxxxxxxx")}
            {field("position", "Position", "text", "Store Manager")}
            <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">
              Address
              <textarea
                value={form.address}
                onChange={(event) => update("address", event.target.value)}
                className={`${inputClass("address")} min-h-24 resize-y`}
                placeholder="User address"
                disabled={submitting}
              />
              {errors.address && (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {errors.address}
                </p>
              )}
            </label>
            {passwordField("password", "Password", "Minimum 8 characters")}
            {passwordField(
              "confirm_password",
              "Confirm password",
              "Repeat password",
            )}
          </div>
          {error && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-stone-200 p-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-stone-300 px-5 py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#362219] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating user..." : "Create user"}
          </button>
        </footer>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title="Create user"
        message="Create this user account with the details you entered?"
        confirmText="Create user"
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={createConfirmedUser}
      />
    </div>
  );
}
