import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { SUB_DAYS, subItemsFromCart, todayIndex } from "@/lib/subscriptions";

// Di keranjang: simpan isi keranjang sebagai paket langganan mingguan.
export const SaveSubscription = () => {
  const { user } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(() => (todayIndex() + 7 - 1) % 7);
  const [name, setName] = useState("Belanja Mingguan");
  const [busy, setBusy] = useState(false);
  if (!items.length || user?.role === "admin") return null;

  const save = async () => {
    if (!user) { navigate("/login"); return; }
    setBusy(true);
    try {
      await api.post("/subscriptions", { name: name.trim() || "Belanja Mingguan", day, items: subItemsFromCart(items), active: true });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success(`Disimpan. Paket muncul di Beranda tiap ${SUB_DAYS[day]}`);
      setOpen(false);
    } catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal menyimpan paket"); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="save-subscription-open"
        className="w-full h-10 rounded-xl border border-emerald-200 text-primary text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-50">
        <CalendarHeart className="w-4 h-4" /> Jadikan paket mingguan
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2" data-testid="save-subscription-form">
      <p className="text-xs text-emerald-800">Isi keranjang ini disimpan sebagai paket. Tiap minggu di hari yang dipilih, paket muncul di Beranda untuk dibeli sekali ketuk. Tidak ada tagihan otomatis.</p>
      <input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nama paket"
        className="w-full h-10 rounded-lg border bg-white px-3 text-sm" />
      <div className="grid grid-cols-7 gap-1">
        {SUB_DAYS.map((d, i) => (
          <button key={d} type="button" onClick={() => setDay(i)} aria-pressed={day === i} data-testid={`sub-day-${i}`}
            className={`h-9 rounded-lg text-[11px] font-bold ${day === i ? "bg-primary text-white" : "bg-white border text-slate-700"}`}>{d.slice(0, 3)}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-xl border bg-white text-sm font-semibold">Batal</button>
        <button type="button" onClick={save} disabled={busy} data-testid="save-subscription-submit"
          className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-70">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan paket tiap {SUB_DAYS[day]}
        </button>
      </div>
    </div>
  );
};
