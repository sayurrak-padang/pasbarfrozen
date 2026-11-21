import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const CodRecap = ({ range }) => {
  const qc = useQueryClient();
  const ahead = new Date(Date.now() + (7 + 48) * 3600 * 1000).toISOString().slice(0, 10);
  const params = { start: range.start, end: range.end < ahead ? ahead : range.end };
  const key = ["cod-report", params.start, params.end];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get("/admin/reports/cod", { params })).data });
  const mark = async (date, deposited) => {
    try { await api.put(`/admin/reports/cod/${date}`, { deposited }); toast.success(deposited ? "Ditandai sudah disetor" : "Tanda setor dibatalkan"); qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  if (!data) return null;
  const s = data.summary;
  return (
    <section className="bg-white rounded-2xl border overflow-x-auto" data-testid="cod-recap">
      <div className="p-4 pb-2 flex flex-wrap items-center gap-x-6 gap-y-1">
        <h3 className="font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> Setoran COD Harian</h3>
        <span className="text-xs text-muted-foreground" data-testid="cod-summary">Tagihan {rupiah(s.due)} · Diterima {rupiah(s.collected)} · Disetor {rupiah(s.deposited)} · Belum diterima {rupiah(s.outstanding)}</span>
      </div>
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Tanggal antar</th><th className="p-3">Pesanan</th><th className="p-3">Harus disetor</th><th className="p-3">Sudah diterima</th><th className="p-3">Belum diterima</th><th className="p-3">Status setor</th></tr></thead>
        <tbody>
          {data.days.map((d) => (
            <tr key={d.date} className="border-t" data-testid={`cod-day-${d.date}`}>
              <td className="p-3 font-medium">{new Date(`${d.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</td>
              <td className="p-3">{d.orders}</td><td className="p-3">{rupiah(d.due)}</td>
              <td className="p-3 text-emerald-700 font-semibold">{rupiah(d.collected)}</td>
              <td className="p-3 text-amber-700">{rupiah(d.outstanding)}</td>
              <td className="p-3">
                {d.deposited ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1" data-testid={`cod-deposited-${d.date}`}><CheckCircle2 className="w-4 h-4" /> Disetor {rupiah(d.deposited_amount)}</span>
                    {d.difference !== 0 && <span className="text-[11px] text-red-600" data-testid={`cod-diff-${d.date}`}>selisih {rupiah(d.difference)}</span>}
                    <button onClick={() => mark(d.date, false)} className="text-muted-foreground" title="Batalkan" data-testid={`cod-undo-${d.date}`}><Undo2 className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-8" disabled={!d.collected} onClick={() => mark(d.date, true)} data-testid={`cod-mark-${d.date}`}>Tandai sudah disetor</Button>
                )}
              </td>
            </tr>
          ))}
          {data.days.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada pesanan COD di periode ini.</td></tr>}
        </tbody>
      </table>
    </section>
  );
};
