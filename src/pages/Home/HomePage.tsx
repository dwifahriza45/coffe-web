import { Coffee, LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

function greeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export default function HomePage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasPermissions = (user?.permissions?.length ?? 0) > 0;

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="grid min-h-[calc(100vh-4.5rem)] place-items-center p-5 sm:p-8">
          <section className="w-full max-w-2xl text-center">
            <span className="mx-auto grid size-24 place-items-center rounded-full border border-[#e6c8b7] bg-white text-[#9d5935] shadow-[0_22px_70px_rgba(54,34,25,0.12)]">
              {hasPermissions ? (
                <Coffee size={42} strokeWidth={1.7} />
              ) : (
                <LockKeyhole size={42} strokeWidth={1.7} />
              )}
            </span>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-[#a25e39]">
              C.R.E.M.A Workspace
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold text-[#211712] sm:text-5xl">
              {greeting()}, {user?.fullname || "Team"}.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-stone-500">
              Welcome back. Choose an available menu from the sidebar to start
              working.
            </p>
            {!hasPermissions && (
              <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
                <Sparkles size={17} className="shrink-0 text-[#9d5935]" />
                Your account does not have menu access yet.
              </div>
            )}
          </section>
        </main>
      </section>
    </div>
  );
}
