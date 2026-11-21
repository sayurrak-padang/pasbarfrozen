import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ST = {
  pending: ["Menunggu transfer", "bg-amber-100 text-amber-700"], done: ["Sudah ditransfer", "bg-emerald-100 text-emerald-700"],
  to_saldo: ["Dialihkan ke Saldo", "bg-sky-100 text-sky-700"],
};

// Refund konsumen yang memilih Metode Pengembalian Dana "Rekening Bank / E-Wallet".
// Admin mentransfer manual lalu klik Sudah Ditransfer. Bila rekening bermasalah, klik
// Alihkan ke Saldo: dana langsung masuk Saldo konsumen, jadi konsumen tidak pernah kehilangan uang.
export const AdminRefundTransfers = () => {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin-refund-transfers"], queryFn: async () => (await api.get("/admin/refund-transfers")).data });
  const decide = async (r, approve) => {
    const note = approve ? "" : (window.prompt("Alasan dialihkan ke Saldo (opsional):") ?? null);
    if (note === null) return;
    if (approve && !window.confirm(`Pastikan Anda SUDAH mentransfer ${rupiah(r.amount)} ke ${r.bank_name} ${r.account_number} a.n. ${r.account_name}. Tandai sudah ditransfer?`)) return;
    try {
      await api.post(`/admin/refund-transfers/${r.refund_id}/decide`, { approve, note });
      toast.success(approve ? "Ditandai sudah ditransfer" : "Refund dialihkan ke Saldo konsumen");
      qc.invalidateQueries({ queryKey: ["admin-refund-transfers"] });
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const pending = items.filter((r) => r.status === "pending").length;
  return (
    <section className="bg-white border rounded-2xl overflow-x-auto mb-4" data-testid="admin-refund-transfers">
      <h3 className="font-semibold p-4 pb-1 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Refund ke Rekening Konsumen {pending > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pending} menunggu</span>}</h3>
      <p className="px-4 pb-2 text-xs text-muted-foreground">Konsumen yang memilih refund ke rekening. Transfer penuh (tanpa potongan) dari rekening toko, lalu klik Sudah Ditransfer.</p>
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-xs text-muted-foreground text-left"><tr><th className="p-3">Konsumen</th><th className="p-3">Keterangan</th><th className="p-3">Rekening</th><th className="p-3">Jumlah</th><th className="p-3">Status</th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.refund_id} className="border-t" data-testid={`admin-refund-${r.refund_id}`}>
              <td className="p-3">{r.user_name}<p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</p></td>
              <td className="p-3 text-xs">{r.note}</td>
              <td className="p-3 text-xs">{r.bank_name} · {r.account_number}<br />a.n. {r.account_name}</td>
              <td className="p-3 font-semibold">{rupiah(r.amount)}</td>
              <td className="p-3">{r.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="sm" className="h-8" onClick={() => decide(r, true)} data-testid={`refund-approve-${r.refund_id}`}>Sudah Ditransfer</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => decide(r, false)} data-testid={`refund-to-saldo-${r.refund_id}`}>Alihkan ke Saldo</Button>
                </div>
              ) : <span className={`text-[10px] px-2 py-0.5 rounded-full ${(ST[r.status] || ST.pending)[1]}`}>{(ST[r.status] || ST.pending)[0]}</span>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada refund ke rekening.</td></tr>}
        </tbody>
      </table>
    </section>
  );
};
