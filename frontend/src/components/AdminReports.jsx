import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, AlertTriangle, Globe, Store } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { CodRecap } from "@/components/CodRecap";
import { Button } from "@/components/ui/button";

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const PRESETS = [["Hari ini", 0], ["7 hari", 6], ["30 hari", 29]];

export const downloadBlob = async (url, params, filename) => {
  try {
    const { data } = await api.get(url, { params, responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { toast.error("Gagal mengunduh"); }
};

const Stat = ({ label, value, tone = "", testid }) => (
  <div className="bg-white rounded-2xl border p-4" data-testid={testid}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-lg font-extrabold ${tone}`}>{value}</p>
  </div>
);

const RangeBar = ({ range, setRange, onExport, exportId }) => (
  <div className="flex flex-wrap items-end gap-2">
    {PRESETS.map(([l, n]) => (
      <Button key={l} size="sm" variant={range.start === daysAgo(n) && range.end === iso(new Date()) ? "default" : "outline"} className="rounded-full"
        data-testid={`report-preset-${n}`} onClick={() => setRange({ start: daysAgo(n), end: iso(new Date()) })}>{l}</Button>
    ))}
    <Input type="date" data-testid="report-start" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className="w-40 h-9" />
    <span className="text-sm">s/d</span>
    <Input type="date" data-testid="report-end" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className="w-40 h-9" />
    <Button size="sm" variant="outline" className="ml-auto gap-1" data-testid={exportId} onClick={onExport}><Download className="w-4 h-4" /> Export Excel</Button>
  </div>
);

// Perbandingan penjualan bersih per saluran: pesanan web vs kasir toko.
const ChannelSummary = ({ range, channel, setChannel }) => {
  const { data } = useQuery({ queryKey: ["report-channels", range.start, range.end], queryFn: async () => (await api.get("/admin/reports/channels", { params: range })).data });
  const total = (data?.web.sales || 0) + (data?.kasir.sales || 0);
  const card = (key, icon, label, d) => {
    const Icon = icon;
    const pct = total ? Math.round(((d?.sales || 0) / total) * 100) : 0;
    return (
      <button type="button" onClick={() => setChannel(key)} aria-pressed={channel === key} data-testid={`report-channel-${key}`}
        className={`text-left bg-white rounded-2xl border-2 p-4 transition-colors ${channel === key ? "border-primary" : "border-transparent hover:border-slate-200"}`}>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon className="w-4 h-4" /> {label} · {d?.count ?? 0} {key === "web" ? "pesanan" : "transaksi"}</p>
        <p className="text-lg font-extrabold">{rupiah(d?.sales || 0)} <span className="text-xs font-semibold text-muted-foreground">{pct}%</span></p>
        <p className="text-xs text-primary font-semibold">Laba kotor {rupiah(d?.profit || 0)}</p>
      </button>
    );
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="report-channels">
      {card("web", Globe, "Pesanan Web", data?.web)}
      {card("kasir", Store, "Kasir Toko", data?.kasir)}
      <div className="bg-slate-900 text-white rounded-2xl p-4">
        <p className="text-xs text-slate-400">Total semua saluran</p>
        <p className="text-lg font-extrabold" data-testid="report-channels-total">{rupiah(total)}</p>
        <p className="text-xs text-emerald-300 font-semibold">Laba kotor {rupiah((data?.web.profit || 0) + (data?.kasir.profit || 0))}</p>
      </div>
    </div>
  );
};

const PAY = { cash: "Tunai", qris: "QRIS", transfer: "Transfer", debit: "Kartu" };

const PosReport = ({ range }) => {
  const [view, setView] = useState("products");
  const { data: r } = useQuery({ queryKey: ["pos-sales", range.start, range.end], queryFn: async () => (await api.get("/admin/pos/sales", { params: range })).data });
  const s = r?.summary;
  if (!s) return null;
  return (
    <div className="space-y-4" data-testid="report-pos">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label={`Penjualan (${s.transactions} transaksi)`} value={rupiah(s.sales)} testid="pos-report-sales" />
        <Stat label="Diskon kasir" value={`− ${rupiah(s.discount)}`} tone="text-amber-600" testid="pos-report-discount" />
        <Stat label="HPP" value={`− ${rupiah(s.hpp)}`} tone="text-red-600" testid="pos-report-hpp" />
        <Stat label="Laba Kotor" value={rupiah(s.gross_profit)} tone="text-primary" testid="pos-report-profit" />
        <Stat label="Margin" value={`${s.margin}%`} testid="pos-report-margin" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs" data-testid="pos-report-payments">
        {r.by_payment.map((b) => <span key={b.method} className="bg-white border rounded-full px-3 py-1">{b.label}: <b>{rupiah(b.total)}</b> ({b.count})</span>)}
        {s.voided > 0 && <span className="bg-red-50 text-red-600 rounded-full px-3 py-1">{s.voided} transaksi dibatalkan (tidak dihitung)</span>}
      </div>
      {s.items_missing_hpp > 0 && (
        <p className="text-xs bg-amber-50 text-amber-700 rounded-xl p-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {s.items_missing_hpp} produk terjual di kasir belum diisi HPP (dihitung 0).</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant={view === "products" ? "default" : "outline"} onClick={() => setView("products")} data-testid="pos-report-view-products">Per Produk</Button>
        <Button size="sm" variant={view === "sales" ? "default" : "outline"} onClick={() => setView("sales")} data-testid="pos-report-view-sales">Per Transaksi</Button>
      </div>
      <div className="bg-white rounded-2xl border overflow-x-auto">
        {view === "products" ? (
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Produk</th><th className="p-3">Qty</th><th className="p-3">Penjualan</th><th className="p-3">HPP</th><th className="p-3">Laba</th></tr></thead>
            <tbody>
              {r.products.map((p) => (
                <tr key={p.product_id + p.name} className="border-t"><td className="p-3"><p className="line-clamp-1 max-w-[260px]">{p.name}</p></td><td className="p-3">{p.qty}</td>
                  <td className="p-3">{rupiah(p.sales)}</td><td className="p-3">{rupiah(p.hpp)}</td><td className="p-3 font-semibold text-primary">{rupiah(p.profit)}</td></tr>
              ))}
              {r.products.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada penjualan kasir di periode ini.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">No. Struk</th><th className="p-3">Tanggal</th><th className="p-3">Bayar</th><th className="p-3">Total</th><th className="p-3">HPP</th><th className="p-3">Laba</th></tr></thead>
            <tbody>
              {r.sales.map((x) => (
                <tr key={x.sale_id} className={`border-t ${x.status === "void" ? "opacity-50 line-through" : ""}`}>
                  <td className="p-3"><p className="font-mono text-xs">{x.sale_id}</p><p className="text-xs text-muted-foreground">{x.cashier}{x.customer_name ? ` · ${x.customer_name}` : ""}</p></td>
                  <td className="p-3 text-xs">{new Date(x.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="p-3 text-xs">{PAY[x.payment_method] || x.payment_method}</td><td className="p-3">{rupiah(x.total)}</td><td className="p-3">{rupiah(x.hpp)}</td>
                  <td className="p-3 font-semibold text-primary">{rupiah(x.total - x.hpp)}</td>
                </tr>
              ))}
              {r.sales.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada transaksi kasir di periode ini.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const AdminReports = () => {
  const [range, setRange] = useState({ start: daysAgo(29), end: iso(new Date()) });
  const [channel, setChannel] = useState("web");
  return (
    <div className="space-y-4" data-testid="admin-reports">
      {channel === "web"
        ? <RangeBar range={range} setRange={setRange} exportId="report-export-xlsx" onExport={() => downloadBlob("/admin/reports/profit.xlsx", range, `laba-rugi-web_${range.start}_${range.end}.xlsx`)} />
        : <RangeBar range={range} setRange={setRange} exportId="pos-report-export-xlsx" onExport={() => downloadBlob("/admin/pos/sales.xlsx", range, `kasir-toko_${range.start}_${range.end}.xlsx`)} />}
      <ChannelSummary range={range} channel={channel} setChannel={setChannel} />
      <h3 className="font-bold text-slate-900">{channel === "web" ? "Laporan Pesanan Web" : "Laporan Kasir Toko"}</h3>
      {channel === "web" ? <WebReport range={range} /> : <PosReport range={range} />}
    </div>
  );
};

const WebReport = ({ range }) => {
  const [view, setView] = useState("products");
  const { data: r } = useQuery({
    queryKey: ["profit", range.start, range.end],
    queryFn: async () => (await api.get("/admin/reports/profit", { params: range })).data,
  });
  const s = r?.summary;

  return (
    <div className="space-y-4" data-testid="report-web">
      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label={`Penjualan web (${s.orders} pesanan)`} value={rupiah(s.sales)} testid="report-sales" />
            <Stat label="Diskon voucher" value={`− ${rupiah(s.discount)}`} tone="text-amber-600" testid="report-discount" />
            <Stat label="HPP" value={`− ${rupiah(s.hpp)}`} tone="text-red-600" testid="report-hpp" />
            <Stat label="Laba Kotor" value={rupiah(s.gross_profit)} tone="text-primary" testid="report-profit" />
            <Stat label="Margin" value={`${s.margin}%`} testid="report-margin" />
          </div>
          <p className="text-xs text-muted-foreground">Ongkir {rupiah(s.shipping)} tidak dihitung sebagai laba. Dihitung dari pesanan berstatus Diproses, Dikirim, dan Selesai.</p>
          <CodRecap range={range} />
          {s.items_missing_hpp > 0 && (
            <p className="text-xs bg-amber-50 text-amber-700 rounded-xl p-3 flex items-center gap-2" data-testid="report-missing-hpp">
              <AlertTriangle className="w-4 h-4" /> {s.items_missing_hpp} produk terjual belum diisi HPP (dihitung 0), sehingga laba terlihat lebih besar.
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant={view === "products" ? "default" : "outline"} onClick={() => setView("products")} data-testid="report-view-products">Per Produk</Button>
            <Button size="sm" variant={view === "orders" ? "default" : "outline"} onClick={() => setView("orders")} data-testid="report-view-orders">Per Pesanan</Button>
          </div>
          <div className="bg-white rounded-2xl border overflow-x-auto">
            {view === "products" ? (
              <table className="w-full text-sm min-w-[640px]" data-testid="report-products-table">
                <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Produk</th><th className="p-3">Qty</th><th className="p-3">Penjualan</th><th className="p-3">HPP</th><th className="p-3">Laba</th></tr></thead>
                <tbody>
                  {r.products.map((p) => (
                    <tr key={p.product_id} className="border-t">
                      <td className="p-3"><p className="line-clamp-1 max-w-[260px]">{p.name}</p>{p.missing_hpp && <span className="text-[10px] text-amber-600 font-semibold">HPP belum diisi</span>}</td>
                      <td className="p-3">{p.qty}</td><td className="p-3">{rupiah(p.sales)}</td><td className="p-3">{rupiah(p.hpp)}</td>
                      <td className="p-3 font-semibold text-primary">{rupiah(p.profit)}</td>
                    </tr>
                  ))}
                  {r.products.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Tidak ada penjualan di periode ini.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm min-w-[760px]" data-testid="report-orders-table">
                <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Pesanan</th><th className="p-3">Tanggal</th><th className="p-3">Penjualan</th><th className="p-3">Diskon</th><th className="p-3">HPP</th><th className="p-3">Laba</th></tr></thead>
                <tbody>
                  {r.orders.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-3"><p className="font-medium">{o.order_id}</p><p className="text-xs text-muted-foreground">{o.customer} · {o.status}</p>{o.missing_hpp && <span className="text-[10px] text-amber-600 font-semibold">HPP belum diisi</span>}</td>
                      <td className="p-3 text-xs">{new Date(o.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-3">{rupiah(o.sales)}</td><td className="p-3">{rupiah(o.discount)}</td><td className="p-3">{rupiah(o.hpp)}</td>
                      <td className="p-3 font-semibold text-primary">{rupiah(o.profit)}</td>
                    </tr>
                  ))}
                  {r.orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada pesanan di periode ini.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
