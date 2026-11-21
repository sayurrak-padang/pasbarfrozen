import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Landmark, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/InfoLinks";
import { BRAND } from "@/config/brand";

const OPTIONS = [
  { key: "saldo", icon: Wallet, title: BRAND.walletName, hint: "Langsung masuk begitu refund disetujui. Bisa dipakai belanja lagi." },
  { key: "bank", icon: Landmark, title: "Rekening Bank / E-Wallet", hint: "Ditransfer admin dalam 1 sampai 3 hari kerja. Tanpa biaya." },
];

const ST = { pending: ["Menunggu transfer", "bg-amber-100 text-amber-800"], done: ["Sudah ditransfer", "bg-emerald-100 text-emerald-800"],
  to_saldo: ["Dialihkan ke Saldo", "bg-sky-100 text-sky-800"] };

export default function RefundMethodPage() {
  const { user, setUser, loading } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/login?mode=masuk"); }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    api.get("/auth/refund-method").then(({ data }) => {
      const { transfers: t, ...rest } = data;
      setF(rest); setTransfers(t || []);
    }).catch(() => setF({ method: "saldo", bank_name: "", account_number: "", account_name: "" }));
  }, [user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.put("/auth/refund-method", f); setF(data); setUser({ ...user, refund_method: data.method }); toast.success("Metode pengembalian dana disimpan"); }
    catch (err) { toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal menyimpan"); }
    finally { setBusy(false); }
  };

  return (
    <div data-testid="refund-method-page">
      <PageHeader title="Metode Pengembalian Dana" sub="Ke mana dana refund dikirim" />
      {!f ? <p className="p-6 text-center text-muted-foreground">Memuat...</p> : (
        <form onSubmit={save} className="px-4 py-4 space-y-3">
          <div className="glass rounded-2xl p-3 flex gap-2 text-[13px] text-slate-700">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p>Dipakai saat pesanan yang sudah dibayar dibatalkan, atau komplain Anda disetujui. Pesanan yang dibayar dengan Saldo selalu dikembalikan ke Saldo.</p>
          </div>
          {OPTIONS.map(({ key, icon: Icon, title, hint }) => {
            const on = f.method === key;
            return (
              <button type="button" key={key} onClick={() => setF({ ...f, method: key })} data-testid={`refund-option-${key}`}
                className={`w-full glass rounded-2xl p-4 flex items-start gap-3 text-left transition-shadow ${on ? "ring-2 ring-emerald-500" : ""}`}>
                <Icon className="w-6 h-6 text-emerald-700 shrink-0" strokeWidth={1.8} />
                <span className="flex-1"><span className="block font-bold">{title}</span><span className="block text-[12.5px] text-muted-foreground mt-0.5">{hint}</span></span>
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${on ? "text-emerald-600" : "text-slate-300"}`} />
              </button>
            );
          })}
          {f.method === "bank" && (
            <div className="glass rounded-2xl p-4 space-y-2" data-testid="refund-bank-form">
              <label className="block text-xs text-muted-foreground">Nama bank / e-wallet
                <Input data-testid="refund-bank" required placeholder="cth. BRI, Bank Nagari, BCA, DANA" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></label>
              <label className="block text-xs text-muted-foreground">Nomor rekening / nomor HP e-wallet
                <Input data-testid="refund-account-number" required inputMode="numeric" pattern="\d{5,20}" placeholder="Hanya angka" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} /></label>
              <label className="block text-xs text-muted-foreground">Nama pemilik rekening
                <Input data-testid="refund-account-name" required placeholder="Sesuai buku tabungan / aplikasi" value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></label>
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl font-bold" data-testid="refund-save">{busy ? "Menyimpan..." : "Simpan"}</Button>

          {transfers.length > 0 && (
            <div className="glass rounded-2xl p-4" data-testid="refund-transfers">
              <h2 className="font-bold mb-2">Riwayat refund ke rekening</h2>
              {transfers.map((t) => (
                <div key={t.refund_id} className="flex items-center justify-between gap-2 py-2 border-t first:border-t-0 text-sm">
                  <div className="min-w-0"><p className="font-semibold">{rupiah(t.amount)}</p><p className="text-[11px] text-muted-foreground truncate">{t.note} · {t.bank_name} {t.account_number}</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${(ST[t.status] || ST.pending)[1]}`}>{(ST[t.status] || ST.pending)[0]}</span>
                </div>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
