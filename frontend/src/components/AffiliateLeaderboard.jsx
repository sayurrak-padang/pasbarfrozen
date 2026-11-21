import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal } from "lucide-react";
import { api, rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";

const METRICS = [["commission", "Komisi"], ["orders", "Pesanan"], ["clicks", "Kunjungan"]];
const MEDAL = ["text-yellow-500", "text-slate-400", "text-orange-700"];
const thisMonth = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);

const Row = ({ x, highlight }) => (
  <div className={`grid grid-cols-[40px_1fr_auto] gap-3 items-center px-3 py-2.5 text-sm border-t first:border-0 ${highlight ? "bg-emerald-50" : ""}`} data-testid={`leaderboard-row-${x.rank}`}>
    <span className="font-extrabold text-center flex items-center justify-center gap-0.5">{x.rank <= 3 && <Medal className={`w-4 h-4 ${MEDAL[x.rank - 1]}`} />}{x.rank}</span>
    <div className="min-w-0"><p className="font-medium line-clamp-1">{x.name}{highlight ? " (Anda)" : ""}</p><p className="text-[11px] text-muted-foreground"><span className="font-mono">{x.ref_code}</span> · {x.orders} pesanan · {x.clicks} klik</p></div>
    <span className="text-right font-bold text-primary">{rupiah(x.commission)}</span>
  </div>
);

export const AffiliateLeaderboard = ({ myCode }) => {
  const [metric, setMetric] = useState("commission");
  const [month, setMonth] = useState(thisMonth());
  const { data } = useQuery({ queryKey: ["aff-leaderboard", metric, month], queryFn: async () => (await api.get("/affiliate/leaderboard", { params: { metric, month } })).data });
  const meOutside = data?.me && !data.top.some((x) => x.ref_code === data.me.ref_code);
  return (
    <section className="bg-white border rounded-2xl p-4 space-y-3" data-testid="affiliate-leaderboard">
      <div className="flex flex-wrap items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" /><h2 className="font-semibold flex-1">Peringkat Affiliate Bulanan</h2>
        <Input type="month" max={thisMonth()} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44 h-9 pr-2" data-testid="leaderboard-month" />
      </div>
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {METRICS.map(([k, l]) => (
          <button key={k} onClick={() => setMetric(k)} data-testid={`leaderboard-metric-${k}`}
            className={`text-xs px-3 h-7 rounded-md transition-colors ${metric === k ? "bg-white shadow font-semibold" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {!data ? <p className="text-sm text-muted-foreground py-6 text-center">Memuat...</p> : data.top.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center" data-testid="leaderboard-empty">Belum ada aktivitas affiliate di bulan {month === thisMonth() ? "ini" : "terpilih"}. Bagikan link Anda dan jadi yang pertama!</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="max-h-96 overflow-y-auto" data-testid="leaderboard-list">
            {data.top.map((x) => <Row key={x.ref_code} x={x} highlight={x.ref_code === myCode} />)}
            {meOutside && <Row x={data.me} highlight />}
          </div>
        </div>
      )}
      {data && myCode && !data.me && data.top.length > 0 && <p className="text-[11px] text-muted-foreground" data-testid="leaderboard-me-empty">Anda belum masuk peringkat bulan ini.</p>}
    </section>
  );
};
