import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, TrendingUp, ShoppingBag, Clock, Package, Star } from "lucide-react";
import { rupiah } from "@/lib/api";

export const STATUS_BADGE = {
  "Menunggu Pembayaran": "bg-amber-50 text-amber-700 border-amber-200",
  Diproses: "bg-sky-50 text-sky-700 border-sky-200",
  Dikirim: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Selesai: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Dibatalkan: "bg-red-50 text-red-700 border-red-200",
};

const Stat = ({ icon: Icon, label, value, sub, tone = "emerald", testid }) => (
  <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-emerald-300 hover:-translate-y-0.5 transition-[transform,border-color] duration-200" data-testid={testid}>
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${tone === "sky" ? "bg-sky-50 text-sky-600 border-sky-100" : tone === "amber" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}><Icon className="w-5 h-5" /></div>
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-4">{label}</p>
    <p className="text-xl 2xl:text-2xl font-extrabold tracking-tight text-slate-900 mt-0.5 whitespace-nowrap">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}jt` : n >= 1e3 ? `${Math.round(n / 1e3)}rb` : `${n}`);

const ChartTip = ({ active, payload, label }) => (active && payload?.length ? (
  <div className="rounded-lg bg-slate-900 text-white text-xs px-3 py-2 shadow-lg">
    <p className="font-semibold mb-1">{new Date(label).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</p>
    {payload.map((p) => <p key={p.dataKey} style={{ color: p.color }}>{p.dataKey === "revenue" ? "Penjualan" : "Laba kotor"}: {rupiah(p.value)}</p>)}
    <p className="text-slate-400">{payload[0].payload.orders} pesanan</p>
  </div>
) : null);

const SalesChart = ({ daily }) => (
  <div className="lg:col-span-2 self-start p-5 rounded-xl bg-white border border-slate-200 shadow-sm" data-testid="admin-sales-chart">
    <div className="flex items-center justify-between mb-4">
      <div><h3 className="font-semibold text-slate-800">Penjualan & Laba Harian</h3><p className="text-xs text-slate-500">14 hari terakhir (pesanan dibayar/COD)</p></div>
      <div className="flex gap-3 text-xs"><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />Penjualan</span><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />Laba kotor</span></div>
    </div>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ left: -10, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity={0.35} /><stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} /></linearGradient>
            <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0284C7" stopOpacity={0.3} /><stop offset="100%" stopColor="#0284C7" stopOpacity={0.02} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => new Date(d).getDate()} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} />
          <Area type="monotone" dataKey="revenue" stroke="#16A34A" strokeWidth={2.5} fill="url(#gSales)" />
          <Area type="monotone" dataKey="profit" stroke="#0284C7" strokeWidth={2} fill="url(#gProfit)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const RECENT_FILTERS = [["all", "Semua"], ["Menunggu Pembayaran", "Menunggu"], ["Diproses", "Diproses"], ["Selesai", "Selesai"], ["Dibatalkan", "Dibatalkan"]];

const RecentOrders = ({ orders, onOpen }) => {
  const [f, setF] = useState("all");
  const list = orders.filter((o) => f === "all" || o.status === f).slice(0, 8);
  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm" data-testid="admin-recent-orders">
      <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-slate-800">Pesanan Terbaru</h3>
        <button onClick={onOpen} className="text-xs font-semibold text-primary hover:underline" data-testid="recent-orders-all">Lihat semua</button></div>
      <div className="flex flex-wrap gap-1 mb-3">
        {RECENT_FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} data-testid={`recent-filter-${k}`} className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${f === k ? "bg-slate-900 text-white border-slate-900" : "hover:border-slate-400"}`}>{l}</button>)}
      </div>
      <ul className="divide-y">
        {list.length === 0 && <li className="text-xs text-slate-500 py-6 text-center">Tidak ada pesanan.</li>}
        {list.map((o) => (
          <li key={o.order_id} className="py-2.5 flex items-center gap-2" data-testid={`recent-order-${o.order_id}`}>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold font-mono truncate">{o.order_id}</p><p className="text-[11px] text-slate-500 truncate">{o.user_name} · {new Date(o.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
            <div className="text-right shrink-0"><p className="text-sm font-bold">{rupiah(o.total)}</p><span className={`text-[10px] border rounded-full px-1.5 py-0.5 ${STATUS_BADGE[o.status] || ""}`}>{o.status}</span></div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const AdminOverview = ({ stats, orders, onOpenOrders }) => (
  <div className="space-y-6" data-testid="admin-overview">
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
      <Stat testid="stat-revenue" icon={DollarSign} label="Pendapatan" value={rupiah(stats?.revenue || 0)} />
      <Stat testid="stat-profit" icon={TrendingUp} tone="sky" label="Laba Kotor" value={rupiah(stats?.gross_profit || 0)} sub="harga jual − HPP" />
      <Stat testid="stat-orders" icon={ShoppingBag} label="Total Pesanan" value={stats?.total_orders || 0} />
      <Stat testid="stat-pending" icon={Clock} tone="amber" label="Menunggu Bayar" value={stats?.pending || 0} />
      <Stat testid="stat-products" icon={Package} label="Produk Aktif" value={stats?.total_products || 0} />
      <Stat testid="stat-rating" icon={Star} tone="amber" label="Rating Rata-rata" value={stats?.rating_count ? `${stats.rating_avg} / 5` : "-"} sub={`${stats?.rating_count || 0} ulasan`} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SalesChart daily={stats?.daily || []} />
      <RecentOrders orders={orders} onOpen={onOpenOrders} />
    </div>
  </div>
);
