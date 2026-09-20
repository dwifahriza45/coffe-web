import { ArrowRight } from "lucide-react";
import Brand from "../../components/layout/Brand";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f5f0]">
      <Brand dark />
      <b className="mt-8 font-serif text-8xl text-[#bb6f46]">404</b>
      <h1 className="font-serif text-4xl font-bold">Not Found</h1>
      <p className="my-4 text-stone-500">Looks like this page has gone cold.</p>
      <a
        className="flex gap-2 rounded-lg bg-[#362219] px-5 py-3 text-white"
        href="/dashboard"
      >
        Back to safety <ArrowRight size={17} />
      </a>
    </main>
  );
}
