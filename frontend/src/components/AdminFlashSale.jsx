import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Trash2, Search, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const wibToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export const ProductPicker = ({ onPick, placeholder = "Cari produk untuk flash sale..." }) => {
  const [q, setQ] = useState("");
  const { data: hits = [] } = useQuery({
    queryKey: ["flash-product-search", q], enabled: q.trim().length >= 2,
    queryFn: async () => (await api.get("/products", { params: { search: q } })).data.slice(0, 8),
  });
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} data-testid="flash-product-search" />
      {q.trim().length >= 2 && hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-64 overflow-y-auto" data-testid="flash-product-results">
          {hits.map((p) => (
            <button key={p.product_id} type="button" onClick={() => { onPick(p); setQ(""); }} data-testid={`flash-product-option-${p.product_id}`}
              className="w-full text-left text-xs px-3 py-2 hover:bg-emerald-50 flex items-center gap-2 border-b last:border-0">
              <img src={p.image} alt="" className="w-8 h-8 rounded object-cover" />
              <span className="flex-1 line-clamp-1">{p.name}</span><span className="text-muted-foreground">{rupiah(p.final_price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AddForm = ({ date, onAdded }) => {
  const [p, setP] = useState(null);
  const [f, setF] = useState({ variant_id: "", flash_price: "", quota: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/admin/flash-sale", { date, product_id: p.product_id, variant_id: f.variant_id || null, flash_price: Number(f.flash_price), quota: Number(f.quota) });
      toast.success("Produk ditambahkan ke flash sale");
      setP(null); setF({ variant_id: "", flash_price: "", quota: "" }); onAdded();
    } catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal menambah"); }
    finally { setBusy(false); }
  };
  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3" data-testid="flash-add-form">
      <p className="text-sm font-semibold">Tambah produk</p>
      <ProductPicker onPick={(x) => { setP(x); setF({ variant_id: x.variants?.[0]?.variant_id || "", flash_price: "", quota: "" }); }} />
      {p && (
        <div className="space-y-2">
          <p className="text-xs" data-testid="flash-picked-product">Dipilih: <b>{p.name}</b> · harga normal {rupiah(p.final_price)}</p>
          {p.variants?.length > 0 && (
            <select className="w-full h-10 rounded-md border px-3 text-sm" value={f.variant_id} onChange={(e) => setF({ ...f, variant_id: e.target.value })} data-testid="flash-variant-select">
              {p.variants.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.name} · {rupiah(v.price)}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted-foreground">Harga flash (Rp)<Input type="number" min={1} value={f.flash_price} onChange={(e) => setF({ ...f, flash_price: e.target.value })} data-testid="flash-price-input" /></label>
            <label className="text-[11px] text-muted-foreground">Kuota (pcs)<Input type="number" min={1} value={f.quota} onChange={(e) => setF({ ...f, quota: e.target.value })} data-testid="flash-quota-input" /></label>
          </div>
          <Button onClick={submit} disabled={busy || !f.flash_price || !f.quota} className="gap-1" data-testid="flash-add-btn"><Zap className="w-4 h-4" /> Tambahkan</Button>
        </div>
      )}
    </div>
  );
};

const FlashRow = ({ f, onChange }) => {
  const [price, setPrice] = useState(f.flash_price);
  const [quota, setQuota] = useState(f.quota);
  const save = async () => {
    try {
      await api.put(`/admin/flash-sale/${f.flash_id}`, { date: f.date, product_id: f.product_id, variant_id: f.variant_id, flash_price: Number(price), quota: Number(quota) });
      toast.success("Disimpan"); onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };
  const del = async () => { await api.delete(`/admin/flash-sale/${f.flash_id}`); toast.success("Dihapus"); onChange(); };
  return (
    <div className="grid grid-cols-[48px_1fr_110px_90px_80px_auto] gap-3 items-center px-4 py-3 border-t text-sm" data-testid={`flash-row-${f.flash_id}`}>
      <img src={f.product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
      <div className="min-w-0"><p className="font-medium line-clamp-1">{f.product.name}{f.variant_name ? ` · ${f.variant_name}` : ""}</p><p className="text-[11px] text-muted-foreground">Normal {rupiah(f.normal_price)}</p></div>
      <Input type="number" className="h-9" value={price} onChange={(e) => setPrice(e.target.value)} data-testid={`flash-row-price-${f.flash_id}`} />
      <Input type="number" className="h-9" value={quota} onChange={(e) => setQuota(e.target.value)} data-testid={`flash-row-quota-${f.flash_id}`} />
      <span className="text-xs" data-testid={`flash-row-sold-${f.flash_id}`}>{f.sold}/{f.quota} terjual</span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={save} data-testid={`flash-row-save-${f.flash_id}`}><Save className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" className="h-8 w-8 text-red-600" onClick={del} data-testid={`flash-row-delete-${f.flash_id}`}><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

const WaSettings = () => {
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ["flash-wa"], queryFn: async () => (await api.get("/admin/flash-wa-settings")).data });
  if (!s) return null;
  const save = async (patch) => {
    try { const { data } = await api.put("/admin/flash-wa-settings", { enabled: s.enabled, audience: s.audience, ...patch }); qc.setQueryData(["flash-wa"], data); toast.success("Pengaturan WA disimpan"); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };
  const last = s.last_run;
  return (
    <div className="bg-white border rounded-2xl p-4 space-y-2" data-testid="flash-wa-settings">
      <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-600" /><p className="text-sm font-semibold flex-1">WhatsApp Flash Sale · tiap hari 07.00 WIB</p>
        <Switch checked={s.enabled} onCheckedChange={(v) => save({ enabled: v })} data-testid="flash-wa-enabled" /></div>
      <div className="flex flex-wrap gap-2">
        {[["loyal", "Pelanggan setia (≥2 pesanan selesai / 90 hari)"], ["buyers", "Semua yang pernah belanja"]].map(([v, l]) => (
          <button key={v} onClick={() => save({ audience: v })} data-testid={`flash-wa-audience-${v}`}
            className={`text-xs px-3 h-8 rounded-full border transition-colors ${s.audience === v ? "bg-primary text-white border-primary" : "bg-white hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="flash-wa-recipients">Penerima saat ini: <b>{s.recipients}</b> pelanggan WA terverifikasi. Dikirim hanya bila ada jadwal flash sale hari itu, sekali per hari.</p>
      {last && <p className="text-[11px] text-muted-foreground" data-testid="flash-wa-last-run">Terakhir: {last.date} · terkirim {last.sent ?? 0}, gagal {last.failed ?? 0}{last.error ? ` · ${last.error}` : ""}</p>}
    </div>
  );
};

export const AdminFlashSale = () => {
  const qc = useQueryClient();
  const [date, setDate] = useState(wibToday());
  const { data: items = [] } = useQuery({ queryKey: ["admin-flash", date], queryFn: async () => (await api.get("/admin/flash-sale", { params: { date } })).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-flash", date] }); qc.invalidateQueries({ queryKey: ["flash-sale"] }); };
  return (
    <div className="space-y-4 max-w-4xl" data-testid="admin-flash-sale">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Tanggal flash sale (WIB)
          <Input type="date" min={wibToday()} value={date} onChange={(e) => setDate(e.target.value)} className="w-48" data-testid="flash-date-input" />
        </label>
        <p className="text-xs text-muted-foreground pb-2">Harga flash berlaku 00:00–23:59 WIB sampai kuota habis, lalu kembali ke harga normal. Jika tidak ada jadwal, beranda menampilkan produk berdiskon biasa.</p>
      </div>
      <WaSettings />
      <AddForm date={date} onAdded={refresh} />
      <div className="bg-white border rounded-2xl overflow-hidden overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[48px_1fr_110px_90px_80px_auto] gap-3 px-4 py-2.5 bg-slate-50 text-xs text-muted-foreground">
            <span /><span>Produk</span><span>Harga flash</span><span>Kuota</span><span>Terjual</span><span />
          </div>
          {items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10" data-testid="flash-empty">Belum ada produk flash sale di tanggal ini.</p>
            : items.map((f) => <FlashRow key={`${f.flash_id}-${f.flash_price}-${f.quota}`} f={f} onChange={refresh} />)}
        </div>
      </div>
    </div>
  );
};
