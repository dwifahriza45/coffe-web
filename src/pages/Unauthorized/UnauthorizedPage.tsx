import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";

export default function UnauthorizedPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex h-[calc(100vh-4.75rem)] items-center justify-center p-5">
          <section className="max-w-lg text-center">
            <span className="relative mx-auto grid h-32 w-32 place-items-center rounded-full border border-[#dcbda9] bg-white text-[#92502f] shadow-[0_16px_40px_rgba(146,80,47,.16)]">
              <span className="absolute inset-5 rounded-full bg-[#b86b42]/25 blur-xl" />
              <LockKeyhole className="relative" size={58} strokeWidth={1.6} />
            </span>
            <h1 className="mt-7 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
              Don&apos;t Have Any Roles
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
              Your account has not been assigned a role. Please contact an
              Administrator or Owner to request access.
            </p>
          </section>
        </main>
      </section>
    </div>
  );
}
