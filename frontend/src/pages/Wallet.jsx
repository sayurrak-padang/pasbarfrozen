import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PiggyBank, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { paySnap, PAY_FAIL } from "@/lib/midtrans";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";

const PRESETS = [50000, 100000, 200000, 500000];
const TYPE = { topup: "Top up", refund: "Refund", payment: "Pembayaran", admin_adjust: "Penyesuaian admin", affiliate: "Komisi affiliate",
  commission: "Dari Saldo Komisi", commission_move: "Dipindah ke Saldo Komisi", withdrawal: "Penarikan komisi", withdrawal_refund: "Penarikan dikembalikan", points: "Tukar poin" };

export default function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(100000);
  const [method, setMethod] = useState("qris");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]);
  const { data } = useQuery({ queryKey: ["wallet"], queryFn: async () => (await api.get("/wallet")).data, enabled: !!user });
  const refresh = () => qc.invalidateQueries({ queryKey: ["wallet"] });

  const check = async (tid) => {
    const { data: t } = await api.get(`/wallet/topup/${tid}/status`);
    if (t.status === "paid") toast.success("Top up berhasil, saldo bertambah");
    refresh();
  };
  const pay = (t) => paySnap(t.snap_token, { onDone: () => check(t.topup_id), onError: () => toast.error(PAY_FAIL) }).catch((e) => toast.error(e.message));

  const topup = async () => {
    if (amount < 10000) { toast.error("Minimal top up Rp10.000"); return; }
    setBusy(true);
    try { const { data: t } = await api.post("/wallet/topup", { amount: Number(amount), method }); refresh(); pay(t); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal membuat top up"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen">
      <div className="border-b sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-white/70">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} data-testid="wallet-back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-primary" /> Saldo Saya</h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-3xl bg-primary text-white p-6">
          <p className="text-sm text-emerald-50">{BRAND.walletName}</p>
          <p className="text-3xl font-extrabold mt-1" data-testid="wallet-balance">{rupiah(data?.balance || 0)}</p>
          <p className="text-xs text-emerald-50 mt-2">Bisa dipakai bayar di checkout. Refund pembatalan & komplain otomatis masuk ke sini.</p>
        </div>
        <div className="glass rounded-2xl p-4 space-y-3" data-testid="topup-form">
          <h3 className="font-bold text-sm">Top Up Saldo</h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <button key={p} data-testid={`topup-preset-${p}`} onClick={() => setAmount(p)} className={`px-3 py-1.5 rounded-full border text-sm ${Number(amount) === p ? "bg-primary text-white border-primary" : ""}`}>{rupiah(p)}</button>)}
          </div>
          <Input data-testid="topup-amount" type="number" min={10000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            {[["qris", "QRIS"], ["va", "Virtual Account"]].map(([v, l]) => (
              <button key={v} data-testid={`topup-method-${v}`} onClick={() => setMethod(v)} className={`h-10 rounded-xl border-2 text-sm font-medium ${method === v ? "border-primary bg-emerald-50" : "border-slate-200"}`}>{l}</button>
            ))}
          </div>
          <Button data-testid="topup-submit" className="w-full h-11 rounded-xl" disabled={busy} onClick={topup}>{busy ? "Memproses..." : `Top Up ${rupiah(Number(amount) || 0)}`}</Button>
        </div>
        {data?.pending_topups?.map((t) => (
          <div key={t.topup_id} className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-2 text-sm" data-testid={`pending-topup-${t.topup_id}`}>
            <span className="flex-1">Top up {rupiah(t.amount)} menunggu pembayaran</span>
            <Button size="sm" onClick={() => pay(t)} data-testid={`pending-topup-pay-${t.topup_id}`}>Bayar</Button>
            <Button size="sm" variant="outline" onClick={() => check(t.topup_id)}>Cek</Button>
          </div>
        ))}
        <div className="glass rounded-2xl divide-y" data-testid="wallet-history">
          <h3 className="font-bold text-sm p-4">Riwayat</h3>
          {(data?.transactions || []).length === 0 && <p className="text-sm text-muted-foreground p-4">Belum ada transaksi.</p>}
          {(data?.transactions || []).map((t) => (
            <div key={t.tx_id} className="flex items-center gap-3 p-4">
              {t.amount > 0 ? <ArrowDownLeft className="w-5 h-5 text-emerald-600" /> : <ArrowUpRight className="w-5 h-5 text-red-500" />}
              <div className="flex-1 min-w-0"><p className="text-sm font-medium">{TYPE[t.type] || t.type}</p><p className="text-xs text-muted-foreground truncate">{t.note} · {new Date(t.created_at).toLocaleString("id-ID")}</p></div>
              <span className={`font-bold text-sm ${t.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>{t.amount > 0 ? "+" : ""}{rupiah(t.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
