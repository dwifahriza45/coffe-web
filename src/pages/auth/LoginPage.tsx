import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { login } from "../../api/auth.api";
import { clearSessionCache } from "../../app/authSession";
import Brand from "../../components/layout/Brand";
import type { ApiResponse } from "../../types/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await login({ email, password });
      if (response.error) {
        setError(response.message);
        return;
      }
      clearSessionCache();
      navigate("/", { replace: true });
    } catch (requestError) {
      const apiError = isAxiosError<ApiResponse<never>>(requestError)
        ? requestError.response?.data
        : undefined;
      setError(
        apiError?.message ||
          "Tidak dapat masuk. Periksa email dan password kamu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-stone-300 bg-white px-4 py-3.5 outline-none transition focus:border-[#9e5a37] focus:ring-4 focus:ring-[#9e5a37]/10 disabled:bg-stone-100";
  return (
    <main className="grid min-h-screen bg-[#fbfaf8] lg:grid-cols-[52%_48%]">
      <section className="hidden flex-col justify-between bg-[linear-gradient(125deg,rgba(33,20,13,.88),rgba(33,20,13,.3)),url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85')] bg-cover bg-center px-[8vw] py-10 text-white lg:flex">
        <Brand />
        <div>
          <p className="text-xs font-bold tracking-[.25em] text-[#dfa47f]">
            CRAFTED WITH INTENTION
          </p>
          <h1 className="my-5 font-serif text-6xl font-bold leading-[1.05]">
            Start your day
            <br />
            with something
            <br />
            <em className="text-[#db9368]">remarkable.</em>
          </h1>
          <p className="max-w-md leading-7 text-stone-300">
            Manage every cup, every order, and every moment—all in one place.
          </p>
        </div>
        <small className="text-stone-400">
          C.R.E.M.A — Coffee Revenue, Management &amp; Analytics.
        </small>
      </section>
      <section className="grid min-h-screen place-items-center p-7">
        <div className="w-full max-w-105">
          <div className="mb-14 lg:hidden">
            <Brand dark />
          </div>
          <p className="text-xs font-bold tracking-[.25em] text-[#a25e39]">
            WELCOME BACK
          </p>
          <h2 className="mt-2 font-serif text-4xl font-bold">
            Good to see you.
          </h2>
          <p className="mb-9 mt-2 text-sm text-stone-500">
            Enter your details to access your workspace.
          </p>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              Email address
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@crema.id"
                disabled={isSubmitting}
                required
                autoFocus
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <span className="relative mt-2 block">
                <input
                  className={`${inputClass} mt-0 pr-12`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 p-3 text-xs text-red-700"
              >
                {error}
              </p>
            )}
            <button
              className="flex w-full justify-center gap-2 rounded-lg bg-[#362219] py-3.5 font-semibold text-white disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Signing in..."
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
