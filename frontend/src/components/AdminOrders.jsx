import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Printer, Truck, ChevronDown, X, Search } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { printLabels } from "@/lib/printLabel";
import { STATUS_BADGE } from "@/components/AdminOverview";
import { ShipmentPanel } from "@/components/ShipmentPanel";
import { CancelRequestPanel } from "@/components/AdminExtras";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BRAND } from "@/config/brand";

export const STATUSES = ["Menunggu Pembayaran", "Diproses", "Dikirim", "Selesai", "Dibatalkan"];

const waNotify = (o) => {
  const phone = (o.address?.phone || "").replace(/\D/g, "").replace(/^0/, "62");
  if (!phone) { toast.error("Nomor HP pembeli tidak tersedia"); return; }
  const msg = `Halo ${o.address?.name || o.user_name}, pesanan *${o.order_id}* di ${BRAND.name} kini berstatus: *${o.status}*. Total ${rupiah(o.total)} via ${o.courier}. Terima kasih sudah belanja!`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
};

const useStore = () => useQuery({ queryKey: ["store-settings"], queryFn: async () => (await api.get("/admin/settings/store")).data });

const OrderDetail = ({ o, store, onChange }) => (
  <div className="px-4 pb-4 pt-1 border-t bg-slate-50/60 text-xs space-y-1" data-testid={`admin-order-detail-${o.order_id}`}>
    <ul className="pt-2 space-y-0.5">{o.items.map((i) => <li key={`${i.product_id}-${i.variant_id || ""}`}>                <div className="flex items-center gap-2 py-1.5 min-w-0">
                  {i.image ? <img src={i.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-slate-100" /> : <span className="w-9 h-9 rounded-lg bg-slate-100 shrink-0" />}
                  <span>{i.quantity}× {i.name}{i.variant_name ? ` (${i.variant_name})` : ""}</span>
                </div>
              </li>)}</ul>
    <p className="text-muted-foreground">{o.address?.name} · {o.address?.phone} · {o.address?.full}</p>
    {o.delivery_slot && <p className="text-amber-700" data-testid={`admin-order-schedule-${o.order_id}`}>Jadwal kirim: {o.delivery_date} · {o.delivery_slot}</p>}
    {o.address?.lat != null && <a href={`https://www.openstreetmap.org/?mlat=${o.address.lat}&mlon=${o.address.lng}#map=18/${o.address.lat}/${o.address.lng}`} target="_blank" rel="noreferrer" className="text-primary underline inline-block" data-testid={`admin-order-map-${o.order_id}`}>Lihat lokasi di peta</a>}
    <CancelRequestPanel order={o} />
    <div className="flex gap-2 pt-1 flex-wrap">
      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => printLabels([o], store)} data-testid={`print-label-${o.order_id}`}><Printer className="w-4 h-4" /> Cetak Label 100x100</Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 text-emerald-700 border-emerald-200" data-testid={`wa-notify-${o.order_id}`} onClick={() => waNotify(o)}><MessageCircle className="w-4 h-4" /> WA</Button>
      {o.status === "Dibatalkan" && <span className="text-red-600 self-center">Dibatalkan oleh {o.cancelled_by === "customer" ? "konsumen" : "admin"}{o.cancel_reason ? `: ${o.cancel_reason}` : ""}</span>}
    </div>
    <ShipmentPanel order={o} admin onChange={onChange} />
    {o.notifications?.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2" data-testid={`admin-order-notifs-${o.order_id}`}>
        {o.notifications.map((n) => (
          <span key={`${n.event}-${n.at}`} title={n.error || ""} className={`text-[10px] rounded-full px-2 py-0.5 ${n.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>WA {n.event} · {n.status === "sent" ? "terkirim" : "gagal"}</span>
        ))}
      </div>
    )}
  </div>
);

const BulkOrderBar = ({ picked, store, onClear, onDone }) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const runEach = async (fn, label) => {
    setBusy(true);
    let ok = 0; const fails = [];
    for (const o of picked) {
      try { await fn(o); ok++; } catch (e) { fails.push(`${o.order_id}: ${e.response?.data?.detail || "gagal"}`); }
    }
    setBusy(false);
    if (ok) toast.success(`${label}: ${ok} pesanan berhasil`);
    if (fails.length) toast.error(`${fails.length} gagal — ${fails.slice(0, 3).join("; ")}`, { duration: 10000 });
    onDone();
  };
  const dispatchable = picked.filter((o) => o.status === "Diproses" && !o.shipment?.biteship_order_id && (o.courier || "").toLowerCase() !== "kurir toko");
  return (
    <div className="sticky top-16 z-10 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="order-bulk-bar">
      <span className="text-sm font-semibold" data-testid="order-bulk-count">{picked.length} dipilih</span>
      <button onClick={onClear} className="text-muted-foreground" data-testid="order-bulk-clear"><X className="w-4 h-4" /></button>
      <Button size="sm" variant="outline" className="gap-1 bg-white" disabled={busy} onClick={() => printLabels(picked, store)} data-testid="order-bulk-print"><Printer className="w-4 h-4" /> Cetak Label ({picked.length})</Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" className="gap-1" disabled={busy || !dispatchable.length} data-testid="order-bulk-dispatch"><Truck className="w-4 h-4" /> Kirim Pesanan ({dispatchable.length})</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pesan kurir untuk {dispatchable.length} pesanan?</AlertDialogTitle>
            <AlertDialogDescription>Biteship akan langsung memanggil driver/kurir dan memotong saldo Biteship. Hanya pesanan berstatus Diproses yang belum dipesan kurirnya yang ikut dikirim.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="order-bulk-dispatch-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="order-bulk-dispatch-confirm" onClick={() => runEach((o) => api.post(`/admin/orders/${o.order_id}/dispatch`), "Kurir dipesan")}>Ya, pesan kurir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-44 h-9 bg-white" data-testid="order-bulk-status"><SelectValue placeholder="Ubah status" /></SelectTrigger>
        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="bg-white" disabled={busy || !status} data-testid="order-bulk-status-apply"
        onClick={() => runEach((o) => api.patch(`/admin/orders/${o.order_id}`, { status }), `Status → ${status}`)}>Terapkan</Button>
      {busy && <span className="text-xs text-muted-foreground" data-testid="order-bulk-busy">Memproses...</span>}
    </div>
  );
};

export const AdminOrders = ({ orders }) => {
  const qc = useQueryClient();
  const { data: store = {} } = useStore();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); };
  const setStatus = async (id, status) => {
    try { await api.patch(`/admin/orders/${id}`, { status }); toast.success("Status pesanan diperbarui"); refresh(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const term = q.toLowerCase();
  const list = orders.filter((o) => (filter === "all" || o.status === filter) &&
    (!term || o.order_id.toLowerCase().includes(term) || (o.user_name || "").toLowerCase().includes(term) || (o.address?.name || "").toLowerCase().includes(term)));
  const picked = orders.filter((o) => selected.includes(o.order_id));
  const toggle = (id, v) => setSelected((s) => v ? [...s, id] : s.filter((x) => x !== id));
  const count = (s) => orders.filter((o) => o.status === s).length;

  return (
    <div data-testid="admin-orders">
      <div className="flex flex-wrap gap-1 mb-3">
        {[["all", `Semua (${orders.length})`], ...STATUSES.map((s) => [s, `${s} (${count(s)})`])].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setSelected([]); }} data-testid={`order-filter-${v.replace(/\s+/g, "-").toLowerCase()}`}
            className={`text-xs px-3 h-8 rounded-full border transition-colors ${filter === v ? "bg-primary text-white border-primary" : "bg-white hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      <div className="relative max-w-sm mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9 h-10" placeholder="Cari no. pesanan / nama" value={q} onChange={(e) => setQ(e.target.value)} data-testid="order-search" />
      </div>
      {picked.length > 0 && <BulkOrderBar picked={picked} store={store} onClear={() => setSelected([])} onDone={refresh} />}
      <div className="bg-white rounded-2xl border overflow-hidden overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[32px_1.3fr_1fr_1fr_110px_180px_32px] gap-2 px-4 py-2.5 bg-slate-50 text-xs text-muted-foreground items-center">
            <Checkbox data-testid="order-select-all" checked={list.length > 0 && list.every((o) => selected.includes(o.order_id))} onCheckedChange={(v) => setSelected(v ? list.map((o) => o.order_id) : [])} />
            <span>Pesanan</span><span>Pembeli</span><span>Kurir / Resi</span><span>Total</span><span>Status</span><span />
          </div>
          {list.length === 0 ? <p className="text-center text-muted-foreground py-12 text-sm" data-testid="order-empty">Belum ada pesanan.</p> : list.map((o) => (
            <div key={o.order_id} data-testid={`admin-order-${o.order_id}`} className={`border-t ${selected.includes(o.order_id) ? "bg-emerald-50/50" : ""}`}>
              <div className="grid grid-cols-[32px_1.3fr_1fr_1fr_110px_180px_32px] gap-2 px-4 py-3 items-center text-sm">
                <Checkbox data-testid={`order-select-${o.order_id}`} checked={selected.includes(o.order_id)} onCheckedChange={(v) => toggle(o.order_id, v)} />
                <div className="min-w-0">
                  <p className="font-mono font-bold text-xs">{o.order_id}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })} · {o.items.length} item · {o.payment_method.toUpperCase()}</p>
                </div>
                <p className="truncate text-xs">{o.address?.name || o.user_name}</p>
                <div className="min-w-0 text-xs">
                  <p className="truncate">{o.courier}</p>
                  {o.shipment?.waybill_id && <p className="font-mono text-[11px] text-muted-foreground truncate" data-testid={`order-resi-${o.order_id}`}>{o.shipment.waybill_id}</p>}
                </div>
                <span className="font-bold text-primary text-xs">{rupiah(o.total)}</span>
                <Select value={o.status} onValueChange={(v) => setStatus(o.order_id, v)} disabled={["Dibatalkan", "Selesai"].includes(o.status)}>
                  <SelectTrigger className={`h-8 text-xs ${STATUS_BADGE[o.status] || ""}`} data-testid={`order-status-${o.order_id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <button onClick={() => setOpen(open === o.order_id ? null : o.order_id)} className="p-1 rounded hover:bg-slate-100" data-testid={`order-expand-${o.order_id}`}>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open === o.order_id ? "rotate-180" : ""}`} />
                </button>
              </div>
              {open === o.order_id && <OrderDetail o={o} store={store} onChange={refresh} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
