import { Coffee, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { useAuth } from "../../app/AuthContext";

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function formatCurrentDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}

const stats = [
  {
    icon: TrendingUp,
    label: "Today’s revenue",
    value: "Rp 8.420.000",
    change: "+12.5%",
  },
  { icon: ShoppingBag, label: "Total orders", value: "128", change: "+8.2%" },
  {
    icon: Package,
    label: "Active products",
    value: "36",
    change: "4 low stock",
  },
  { icon: Users, label: "New customers", value: "24", change: "+5.1%" },
];
const orders = [
  ["#KR-1028", "Cappuccino · 2", "Rp 76.000"],
  ["#KR-1027", "Iced Aren Latte · 1", "Rp 32.000"],
  ["#KR-1026", "V60 Gayo · 2", "Rp 84.000"],
  ["#KR-1025", "Croissant · 3", "Rp 66.000"],
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentDate = new Date();
  return (
    <div className="flex min-h-screen bg-[#f8f5f0]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-5 sm:p-8">
          <header className="flex justify-between">
            <div>
              <p className="text-xs font-bold tracking-[.2em] text-[#a25e39]">
                {formatCurrentDate(currentDate)}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-bold">
                {getGreeting(currentDate)}, {user?.fullname || "User"}.
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Here’s what’s happening at your coffee shop today.
              </p>
            </div>
            <button className="hidden h-fit rounded-lg bg-[#362219] px-5 py-3 text-sm text-white sm:block">
              + New order
            </button>
          </header>
          <section className="my-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ icon: Icon, label, value, change }) => (
              <article
                className="rounded-xl border border-stone-200 bg-white p-5"
                key={label}
              >
                <span className="float-right grid size-10 place-items-center rounded-full bg-[#f2e6dd] text-[#9d5935]">
                  <Icon size={18} />
                </span>
                <p className="text-xs text-stone-500">{label}</p>
                <h2 className="my-3 text-xl font-bold">{value}</h2>
                <small className="rounded-full bg-green-50 px-2 py-1 text-green-700">
                  {change}
                </small>
              </article>
            ))}
          </section>
          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <article className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="font-serif text-lg font-bold">Revenue overview</h2>
              <p className="text-xs text-stone-400">
                Performance over the last 7 days
              </p>
              <div className="mt-7 flex h-56 items-end gap-[5%] border-b px-3">
                {[50, 70, 43, 80, 62, 94, 74].map((height, index) => (
                  <div
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    key={index}
                  >
                    <span
                      className="w-full max-w-9 rounded-t bg-[#b86d45]"
                      style={{ height: `${height}%` }}
                    />
                    <small className="text-[9px]">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}
                    </small>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="font-serif text-lg font-bold">Recent orders</h2>
              <p className="text-xs text-stone-400">Latest store activity</p>
              {orders.map((order) => (
                <div
                  className="flex items-center gap-3 border-b border-stone-100 py-3 last:border-0"
                  key={order[0]}
                >
                  <span className="grid size-8 place-items-center rounded bg-[#f2e6dd] text-[#9d5935]">
                    <Coffee size={15} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <b className="text-xs">{order[0]}</b>
                    <small className="text-[10px] text-stone-500">
                      {order[1]}
                    </small>
                  </span>
                  <strong className="flex flex-col text-right text-xs">
                    {order[2]}
                    <small className="text-green-700">Paid</small>
                  </strong>
                </div>
              ))}
            </article>
          </section>
        </main>
      </section>
    </div>
  );
}
