import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, Trash2, ShoppingBasket, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBuyAgain } from "@/hooks/useBuyAgain";
import { SUB_DAYS } from "@/lib/subscriptions";
import { CartBar } from "@/components/CartBar";

const SubCard = ({ s, onChanged }) => {
  const buy = useBuyAgain();
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = async (patch) => {
    try {
      await api.put(`/subscriptions/${s.subscription_id}`, { name: s.name, day: s.day, items: s.items, active: s.active, ...patch });
      onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };
  const del = async () => {
    try { await api.delete(`/subscriptions/${s.subscription_id}`); toast.success("Paket dihapus"); onChanged(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal menghapus"); }
  };
  return (
    <div className={`bg-white rounded-2xl border p-4 space-y-3 ${s.active ? "" : "opacity-70"}`} data-testid={`subscription-${s.subscription_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.items.length} produk · {s.active ? `tiap ${s.day_name}` : "dijeda"}</p>
        </div>
        <button onClick={() => save({ active: !s.active })} data-testid={`subscription-toggle-${s.subscription_id}`}
          className="h-8 px-3 rounded-full border text-xs font-semibold flex items-center gap-1 shrink-0">
          {s.active ? <><Pause className="w-3.5 h-3.5" /> Jeda</> : <><Play className="w-3.5 h-3.5" /> Aktifkan</>}
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {s.items.map((it) => (
          <span key={`${it.product_id}-${it.variant_id || ""}`} className="relative shrink-0">
            <img src={it.image} alt={it.name} title={it.name} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
            <span className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{it.quantity}</span>
          </span>
        ))}
      </div>
      <label className="block text-xs font-semibold text-slate-600">Hari belanja
        <select value={s.day} onChange={(e) => save({ day: Number(e.target.value) })} data-testid={`subscription-day-${s.subscription_id}`}
          className="mt-1 w-full h-10 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900">
          {SUB_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <button onClick={async () => { setBusy(true); try { await buy(s); } finally { setBusy(false); } }} disabled={busy}
          data-testid={`subscription-add-${s.subscription_id}`}
          className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-70">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} Masukkan ke keranjang
        </button>
        {confirmDel ? (
          <button onClick={del} data-testid={`subscription-delete-confirm-${s.subscription_id}`} className="h-10 px-3 rounded-xl bg-red-600 text-white text-sm font-bold">Hapus?</button>
        ) : (
          <button onClick={() => setConfirmDel(true)} aria-label="Hapus paket" data-testid={`subscription-delete-${s.subscription_id}`} className="h-10 w-10 rounded-xl border text-red-600 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  );
};

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: subs = [], isLoading } = useQuery({ queryKey: ["subscriptions"], queryFn: async () => (await api.get("/subscriptions")).data, enabled: !!user });
  const refresh = () => qc.invalidateQueries({ queryKey: ["subscriptions"] });
  if (!user) return null;
  return (
    <div className="min-h-screen" data-testid="subscriptions-page">
      <div className="bg-emerald-700 text-white rounded-b-[28px] px-4 py-4 shadow-md">
        <h1 className="text-lg font-extrabold flex items-center gap-2"><CalendarHeart className="w-5 h-5" /> Paket Langganan</h1>
        <p className="text-[13px] text-emerald-50">Belanjaan rutin mingguan, tinggal 1 ketuk di hari belanjanya</p>
      </div>
      <div className="px-4 pt-5 pb-36 space-y-4">
        {isLoading ? <div className="h-48 rounded-2xl bg-slate-200 animate-pulse" aria-hidden /> : subs.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-sm text-slate-600 space-y-2" data-testid="subscriptions-empty">
            <p className="font-bold text-slate-900">Belum ada paket langganan</p>
            <p>Isi keranjang dengan belanjaan rutin, buka keranjang, lalu ketuk <b>Jadikan paket mingguan</b>. Di hari belanjanya, paket muncul di Beranda dan bisa dimasukkan ke keranjang sekali ketuk.</p>
          </div>
        ) : subs.map((s) => <SubCard key={s.subscription_id} s={s} onChanged={refresh} />)}
        <p className="text-xs text-slate-500">Paket tidak memesan atau menagih otomatis. Pesanan tetap dibuat dan dibayar seperti biasa lewat checkout.</p>
      </div>
      <CartBar />
    </div>
  );
}
