import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Loader2 } from "lucide-react";
import { api, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBuyAgain } from "@/hooks/useBuyAgain";

// "Belanja lagi" di Beranda: pesanan terakhir pembeli, masuk keranjang dengan 1 ketukan.
export const BuyAgainSection = () => {
  const { user } = useAuth();
  const buyAgain = useBuyAgain();
  const [busy, setBusy] = useState(null);
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/orders")).data,
    enabled: !!user && user.role !== "admin",
  });
  const recent = orders.filter((o) => o.status !== "Dibatalkan" && o.items?.length).slice(0, 3);
  if (!recent.length) return null;

  const run = async (o) => { setBusy(o.order_id); try { await buyAgain(o); } finally { setBusy(null); } };

  return (
    <section data-testid="buy-again-section">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-extrabold tracking-tight">Belanja Lagi</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 snap-x">
        {recent.map((o) => {
          const qty = o.items.reduce((s, it) => s + (it.quantity || 0), 0);
          return (
            <div key={o.order_id} className="snap-start shrink-0 w-[260px] glass rounded-2xl p-3" data-testid={`buy-again-card-${o.order_id}`}>
              <div className="flex -space-x-2">
                {o.items.slice(0, 4).map((it) => (
                  <img key={`${it.product_id}-${it.variant_id || ""}`} src={it.image} alt={it.name} className="w-11 h-11 rounded-xl object-cover border-2 border-white bg-slate-100" />
                ))}
                {o.items.length > 4 && <span className="w-11 h-11 rounded-xl border-2 border-white bg-emerald-50 text-primary text-xs font-bold flex items-center justify-center">+{o.items.length - 4}</span>}
              </div>
              <p className="mt-2 text-sm font-semibold line-clamp-1">{o.items.map((it) => it.name).join(", ")}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {qty} barang · {rupiah(o.total)}
              </p>
              <button onClick={() => run(o)} disabled={busy === o.order_id} data-testid={`home-buy-again-${o.order_id}`}
                className="mt-2.5 w-full h-9 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-70">
                {busy === o.order_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Beli lagi
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
