import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Loader2, ShoppingBasket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBuyAgain } from "@/hooks/useBuyAgain";
import { todayIndex } from "@/lib/subscriptions";

// Di hari paket langganan (atau sehari sebelumnya), tampilkan paket di Beranda untuk dibeli 1 ketukan.
export const SubscriptionReminder = () => {
  const { user } = useAuth();
  const buy = useBuyAgain();
  const [busy, setBusy] = useState(null);
  const { data: subs = [] } = useQuery({
    queryKey: ["subscriptions"], queryFn: async () => (await api.get("/subscriptions")).data,
    enabled: !!user && user.role !== "admin",
  });
  const t = todayIndex();
  const due = subs.filter((s) => s.active && (s.day === t || s.day === (t + 1) % 7));
  if (!due.length) return null;
  const run = async (s) => { setBusy(s.subscription_id); try { await buy(s); } finally { setBusy(null); } };
  return (
    <section className="space-y-2" data-testid="subscription-reminder">
      {due.map((s) => (
        <div key={s.subscription_id} className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-3 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><CalendarHeart className="w-5 h-5" /></span>
          <Link to="/langganan" className="flex-1 min-w-0 leading-tight">
            <span className="block font-bold text-sm truncate">{s.name} · {s.day === t ? "hari ini" : "besok"}</span>
            <span className="block text-xs text-emerald-50 truncate">{s.items.length} produk · tiap {s.day_name}</span>
          </Link>
          <button onClick={() => run(s)} disabled={busy === s.subscription_id} data-testid={`subscription-buy-${s.subscription_id}`}
            className="h-9 px-3 rounded-xl bg-white text-emerald-800 text-sm font-bold flex items-center gap-1 shrink-0 disabled:opacity-70">
            {busy === s.subscription_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} Beli
          </button>
        </div>
      ))}
    </section>
  );
};
