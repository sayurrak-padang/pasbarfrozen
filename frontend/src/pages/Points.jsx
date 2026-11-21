import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Gift, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function PointsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: p, isLoading } = useQuery({ queryKey: ["points"], queryFn: async () => (await api.get("/points")).data, enabled: !!user });
  if (!user) return null;

  const pts = Number(amount) || 0;
  const redeem = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/points/redeem", { points: pts });
      toast.success(`${data.redeemed} poin ditukar jadi ${rupiah(data.amount)} saldo`);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["points"] });
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menukar poin"); }
    finally { setBusy(false); }
  };
  const copy = async (code) => { try { await navigator.clipboard.writeText(code); toast.success(`Kode ${code} disalin`); } catch { toast(`Kode voucher: ${code}`); } };

  return (
    <div className="min-h-screen" data-testid="points-page">
      <div className="bg-emerald-700 text-white rounded-b-[28px] px-4 pt-4 pb-6 shadow-md">
        <h1 className="text-lg font-extrabold flex items-center gap-2"><Coins className="w-5 h-5" /> Poin & Voucher</h1>
        {isLoading || !p ? <div className="mt-3 h-12 w-40 rounded-xl bg-white/20 animate-pulse" aria-hidden /> : (
          <div className="mt-3">
            <p className="text-4xl font-extrabold tabular-nums" data-testid="points-available">{p.available.toLocaleString("id-ID")} <span className="text-base font-bold">poin</span></p>
            <p className="text-[13px] text-emerald-50">Senilai {rupiah(p.available * p.point_value)} · total didapat {p.earned.toLocaleString("id-ID")} poin</p>
          </div>
        )}
      </div>
      <div className="px-4 py-5 space-y-4">
        {p?.first_order_voucher && (
          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 flex items-center gap-3" data-testid="points-first-voucher">
            <Gift className="w-6 h-6 text-amber-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-amber-950">{p.first_order_voucher.description}</p>
              <p className="text-xs text-amber-900/80">Kode <b>{p.first_order_voucher.code}</b></p>
            </div>
            <button onClick={() => copy(p.first_order_voucher.code)} className="h-9 px-3 rounded-xl bg-amber-950 text-amber-50 text-xs font-bold flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Salin</button>
          </div>
        )}
        {p && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="font-bold">Tukar poin jadi Saldo</p>
            <p className="text-xs text-muted-foreground">1 poin = {rupiah(p.point_value)}. Minimal tukar {p.min_redeem} poin. Saldo bisa dipakai untuk bayar pesanan.</p>
            <div className="flex gap-2">
              <input id="points-amount" type="number" inputMode="numeric" min={p.min_redeem} max={p.available} value={amount} placeholder={`${p.min_redeem}`}
                onChange={(e) => setAmount(e.target.value)} data-testid="points-input"
                className="flex-1 min-w-0 h-11 rounded-xl border px-3 text-sm" />
              <button onClick={() => setAmount(String(p.available))} className="h-11 px-3 rounded-xl border text-sm font-semibold">Semua</button>
            </div>
            <button onClick={redeem} disabled={busy || pts < p.min_redeem || pts > p.available} data-testid="points-redeem"
              className="w-full h-11 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Tukar {pts > 0 ? `jadi ${rupiah(pts * p.point_value)}` : ""}
            </button>
          </div>
        )}
        <div className="glass rounded-2xl p-4 text-sm text-slate-600 space-y-1">
          <p className="font-bold text-slate-900">Cara dapat poin</p>
          <p>Setiap belanja {rupiah(p?.per_rupiah || 1000)} dapat 1 poin. Poin masuk setelah pesanan berstatus Selesai.</p>
        </div>
      </div>
    </div>
  );
}
