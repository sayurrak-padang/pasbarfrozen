import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ST = {
  pending: ["Menunggu transfer admin", "bg-amber-100 text-amber-700"], approved: ["Sudah ditransfer", "bg-emerald-100 text-emerald-700"],
  rejected: ["Ditolak · kembali ke Saldo Komisi", "bg-red-100 text-red-600"], done: ["Masuk Saldo", "bg-sky-100 text-sky-700"],
};

const METHODS = [
  { key: "saldo", icon: Wallet, title: "Ke Saldo", hint: "Gratis, langsung masuk" },
  { key: "bank", icon: Landmark, title: "Ke Rekening", hint: "Biaya Rp2.500, ditransfer admin" },
];

const errMsg = (err) => err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal mengajukan";

// Komisi affiliate ada di Saldo Komisi. Pemilik akun memilih: pindah ke Saldo (gratis, langsung)
// atau tarik ke rekening bank (biaya admin, admin mentransfer manual lalu menandai "Sudah ditransfer").
export const WithdrawPanel = () => {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["withdrawals"], queryFn: async () => (await api.get("/affiliate/withdrawals")).data });
  const [method, setMethod] = useState("saldo");
  const [f, setF] = useState({ amount: "", bank_name: "", account_number: "", account_name: "" });
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  if (!filled && data.last_account) { setFilled(true); setF((x) => ({ ...x, ...data.last_account })); }
  const amt = Number(f.amount) || 0;
  const bank = method === "bank";
  const min = bank ? data.min : data.saldo_min;
  const fee = bank ? data.fee : 0;
  const submit = async (e) => {
    e.preventDefault();
    if (amt < min) { toast.error(`Minimal ${bank ? "tarik ke rekening" : "pindah ke Saldo"} ${rupiah(min)}`); return; }
    if (amt > data.available) { toast.error("Jumlah melebihi Saldo Komisi"); return; }
    setBusy(true);
    try {
      await api.post("/affiliate/withdrawals", bank ? { ...f, method, amount: amt } : { method, amount: amt });
      toast.success(bank ? "Pengajuan terkirim. Admin akan mentransfer ke rekening Anda" : `${rupiah(amt)} masuk ke Saldo Anda`);
      setF({ ...f, amount: "" });
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["affiliate-me"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };
  return (
    <section className="bg-white border rounded-2xl p-4 space-y-3" data-testid="withdraw-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> Tarik Komisi</h2>
          <p className="text-xs text-muted-foreground">Saldo Komisi Anda</p>
        </div>
        <p className="text-xl font-extrabold text-primary tabular-nums" data-testid="withdraw-available">{rupiah(data.available)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tujuan penarikan" data-testid="withdraw-method">
        {METHODS.map(({ key, icon: Icon, title, hint }) => (
          <button key={key} type="button" role="radio" aria-checked={method === key} onClick={() => setMethod(key)} data-testid={`withdraw-method-${key}`}
            className={`text-left rounded-xl border-2 p-3 transition-colors ${method === key ? "border-primary bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
            <Icon className={`w-5 h-5 mb-1 ${method === key ? "text-primary" : "text-slate-500"}`} />
            <span className="block text-sm font-bold">{title}</span>
            <span className="block text-[11px] text-muted-foreground leading-tight">{hint}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-2">
        <div className="flex gap-2">
          <Input data-testid="withdraw-amount" type="number" min={min} placeholder={`Jumlah (min ${rupiah(min)})`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          <Button type="button" variant="outline" className="shrink-0" onClick={() => setF({ ...f, amount: String(data.available) })} data-testid="withdraw-all">Semua</Button>
        </div>
        {bank && (<>
          <Input data-testid="withdraw-bank" placeholder="Nama bank / e-wallet (cth BCA)" value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} required />
          <Input data-testid="withdraw-account-number" inputMode="numeric" placeholder="No. rekening" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} required />
          <Input data-testid="withdraw-account-name" placeholder="Nama pemilik rekening" value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} required />
        </>)}
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs space-y-0.5" data-testid="withdraw-transfer-preview">
          <p className="flex justify-between"><span>Jumlah</span><span>{rupiah(amt)}</span></p>
          <p className="flex justify-between"><span>Biaya {bank ? "transfer" : ""}</span><span>{fee ? `− ${rupiah(fee)}` : "Gratis"}</span></p>
          <p className="flex justify-between font-bold text-sm pt-1 border-t"><span>{bank ? "Diterima di rekening" : "Masuk ke Saldo"}</span><span>{rupiah(Math.max(0, amt - fee))}</span></p>
        </div>
        <Button type="submit" disabled={busy || data.available < min} data-testid="withdraw-submit">{bank ? "Ajukan Tarik ke Rekening" : "Pindahkan ke Saldo"}</Button>
        {bank && <p className="text-[11px] text-muted-foreground">Admin mentransfer manual ke rekening di atas, biasanya 1x24 jam kerja. Jika ditolak, dana kembali ke Saldo Komisi.</p>}
      </form>
      {data.items.map((w) => (
        <div key={w.withdrawal_id} className="flex items-center justify-between border-t pt-2 text-sm" data-testid={`withdraw-item-${w.withdrawal_id}`}>
          <div className="min-w-0"><p className="font-mono text-xs">{w.withdrawal_id}</p><p className="text-[11px] text-muted-foreground truncate">{w.method === "saldo" ? "Ke Saldo" : `${w.bank_name} ${w.account_number}`} · {new Date(w.created_at).toLocaleDateString("id-ID")}{w.note ? ` · ${w.note}` : ""}</p></div>
          <div className="text-right shrink-0"><p className="font-semibold">{rupiah(w.amount)}</p><span className={`text-[10px] px-2 py-0.5 rounded-full ${(ST[w.status] || ST.pending)[1]}`}>{(ST[w.status] || ST.pending)[0]}</span></div>
        </div>
      ))}
    </section>
  );
};

export const AdminWithdrawals = () => {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: async () => (await api.get("/admin/withdrawals")).data });
  const decide = async (w, approve) => {
    const note = approve ? "" : (window.prompt("Alasan penolakan (opsional):") ?? null);
    if (note === null) return;
    if (approve && !window.confirm(`Pastikan Anda SUDAH mentransfer ${rupiah(w.transfer_amount)} ke ${w.bank_name} ${w.account_number} a.n. ${w.account_name}. Tandai sudah ditransfer?`)) return;
    try { await api.post(`/admin/withdrawals/${w.withdrawal_id}/decide`, { approve, note }); toast.success(approve ? "Ditandai sudah ditransfer" : "Penarikan ditolak, dana kembali ke Saldo Komisi"); qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <section className="bg-white border rounded-2xl overflow-x-auto" data-testid="admin-withdrawals">
      <h3 className="font-semibold p-4 pb-1 flex items-center gap-2"><Landmark className="w-4 h-4" /> Penarikan Komisi ke Rekening</h3>
      <p className="px-4 pb-2 text-xs text-muted-foreground">Transfer dulu jumlah di kolom "Ditransfer" (sudah dipotong biaya {rupiah(2500)}) dari rekening toko, lalu klik Sudah Ditransfer. Pindah komisi ke Saldo tidak perlu persetujuan.</p>
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-xs text-muted-foreground text-left"><tr><th className="p-3">Affiliate</th><th className="p-3">Rekening</th><th className="p-3">Jumlah</th><th className="p-3">Ditransfer</th><th className="p-3">Status</th></tr></thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.withdrawal_id} className="border-t" data-testid={`admin-withdraw-${w.withdrawal_id}`}>
              <td className="p-3">{w.user_name}<p className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleString("id-ID")}</p></td>
              <td className="p-3 text-xs">{w.bank_name} · {w.account_number}<br />a.n. {w.account_name}</td>
              <td className="p-3">{rupiah(w.amount)}</td><td className="p-3 font-semibold">{rupiah(w.transfer_amount)}</td>
              <td className="p-3">{w.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="sm" className="h-8" onClick={() => decide(w, true)} data-testid={`withdraw-approve-${w.withdrawal_id}`}>Sudah Ditransfer</Button>
                  <Button size="sm" variant="outline" className="h-8 text-red-600" onClick={() => decide(w, false)} data-testid={`withdraw-reject-${w.withdrawal_id}`}>Tolak</Button>
                </div>
              ) : <span className={`text-[10px] px-2 py-0.5 rounded-full ${(ST[w.status] || ST.pending)[1]}`}>{(ST[w.status] || ST.pending)[0]}</span>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada pengajuan penarikan.</td></tr>}
        </tbody>
      </table>
    </section>
  );
};
