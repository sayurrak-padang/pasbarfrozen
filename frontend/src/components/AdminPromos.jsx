import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminFlashSale, ProductPicker } from "@/components/AdminFlashSale";

const wibToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const errMsg = (e) => { const d = e.response?.data?.detail; return Array.isArray(d) ? d[0]?.msg : d || "Gagal menyimpan"; };
const STATUS = { active: ["Berjalan", "bg-emerald-100 text-emerald-700"], scheduled: ["Terjadwal", "bg-sky-100 text-sky-700"], ended: ["Selesai", "bg-slate-100 text-slate-500"] };

const AddPromo = ({ section, onAdded }) => {
  const [p, setP] = useState(null);
  const [f, setF] = useState({ variant_id: "", promo_price: "", start_date: wibToday(), end_date: wibToday() });
  const submit = async () => {
    try {
      await api.post("/admin/promos", { section, product_id: p.product_id, ...f, variant_id: f.variant_id || null, promo_price: Number(f.promo_price) });
      toast.success("Produk promo ditambahkan");
      setP(null); setF({ ...f, variant_id: "", promo_price: "" }); onAdded();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="bg-white border rounded-2xl p-4 space-y-3" data-testid={`promo-add-form-${section}`}>
      <p className="text-sm font-semibold">Tambah produk</p>
      <ProductPicker placeholder="Cari produk..." onPick={(x) => { setP(x); setF((s) => ({ ...s, variant_id: x.variants?.[0]?.variant_id || "", promo_price: "" })); }} />
      {p && (
        <div className="space-y-2">
          <p className="text-xs" data-testid="promo-picked-product">Dipilih: <b>{p.name}</b> · harga normal {rupiah(p.final_price)}</p>
          {p.variants?.length > 0 && (
            <select className="w-full h-10 rounded-md border px-3 text-sm" value={f.variant_id} onChange={(e) => setF({ ...f, variant_id: e.target.value })} data-testid="promo-variant-select">
              {p.variants.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.name} · {rupiah(v.price)}</option>)}
            </select>
          )}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-muted-foreground">Harga promo (Rp)<Input type="number" min={1} value={f.promo_price} onChange={(e) => setF({ ...f, promo_price: e.target.value })} data-testid="promo-price-input" /></label>
            <label className="text-[11px] text-muted-foreground">Mulai<Input type="date" min={wibToday()} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} data-testid="promo-start-input" /></label>
            <label className="text-[11px] text-muted-foreground">Selesai<Input type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} data-testid="promo-end-input" /></label>
          </div>
          <Button onClick={submit} disabled={!f.promo_price} className="gap-1" data-testid="promo-add-btn"><Plus className="w-4 h-4" /> Tambahkan</Button>
        </div>
      )}
    </div>
  );
};

const PromoItemRow = ({ x, onChange }) => {
  const [f, setF] = useState({ promo_price: x.promo_price, start_date: x.start_date, end_date: x.end_date });
  const [label, cls] = STATUS[x.status];
  const save = async () => {
    try { await api.put(`/admin/promos/${x.promo_id}`, { section: x.section, product_id: x.product_id, variant_id: x.variant_id, ...f, promo_price: Number(f.promo_price) }); toast.success("Disimpan"); onChange(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const del = async () => { await api.delete(`/admin/promos/${x.promo_id}`); toast.success("Dihapus"); onChange(); };
  return (
    <div className="grid grid-cols-[48px_1fr_110px_130px_130px_80px_auto] gap-3 items-center px-4 py-3 border-t text-sm" data-testid={`promo-row-${x.promo_id}`}>
      <img src={x.product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
      <div className="min-w-0"><p className="font-medium line-clamp-1">{x.product.name}{x.variant_name ? ` · ${x.variant_name}` : ""}</p><p className="text-[11px] text-muted-foreground">Normal {rupiah(x.normal_price)}</p></div>
      <Input type="number" className="h-9" value={f.promo_price} onChange={(e) => setF({ ...f, promo_price: e.target.value })} data-testid={`promo-row-price-${x.promo_id}`} />
      <Input type="date" className="h-9" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} data-testid={`promo-row-start-${x.promo_id}`} />
      <Input type="date" className="h-9" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} data-testid={`promo-row-end-${x.promo_id}`} />
      <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 text-center ${cls}`} data-testid={`promo-row-status-${x.promo_id}`}>{label}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={save} data-testid={`promo-row-save-${x.promo_id}`}><Save className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" className="h-8 w-8 text-red-600" onClick={del} data-testid={`promo-row-delete-${x.promo_id}`}><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

const PromoManager = ({ section, hint }) => {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin-promos", section], queryFn: async () => (await api.get("/admin/promos", { params: { section } })).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-promos", section] }); qc.invalidateQueries({ queryKey: ["promos"] }); };
  return (
    <div className="space-y-4" data-testid={`promo-manager-${section}`}>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <AddPromo section={section} onAdded={refresh} />
      <div className="bg-white border rounded-2xl overflow-hidden overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[48px_1fr_110px_130px_130px_80px_auto] gap-3 px-4 py-2.5 bg-slate-50 text-xs text-muted-foreground">
            <span /><span>Produk</span><span>Harga promo</span><span>Mulai</span><span>Selesai</span><span>Status</span><span />
          </div>
          {items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10" data-testid={`promo-empty-${section}`}>Belum ada produk. Beranda memakai pilihan otomatis.</p>
            : items.map((x) => <PromoItemRow key={`${x.promo_id}-${x.promo_price}-${x.start_date}-${x.end_date}`} x={x} onChange={refresh} />)}
        </div>
      </div>
    </div>
  );
};

export const AdminPromos = () => (
  <Tabs defaultValue="flash" className="max-w-5xl" data-testid="admin-promos">
    <TabsList className="mb-4">
      <TabsTrigger value="flash" data-testid="promo-tab-flash">Flash Sale</TabsTrigger>
      <TabsTrigger value="best" data-testid="promo-tab-best">Diskon Terbaik</TabsTrigger>
      <TabsTrigger value="pick" data-testid="promo-tab-pick">Produk Pilihan</TabsTrigger>
    </TabsList>
    <TabsContent value="flash"><AdminFlashSale /></TabsContent>
    <TabsContent value="best"><PromoManager section="best" hint="Produk & harga diskon untuk bagian Diskon Terbaik di beranda. Harga promo berlaku otomatis di keranjang & checkout selama tanggal berlaku (WIB)." /></TabsContent>
    <TabsContent value="pick"><PromoManager section="pick" hint="Produk & harga khusus untuk bagian Produk Pilihan di beranda. Harga promo berlaku otomatis di keranjang & checkout selama tanggal berlaku (WIB)." /></TabsContent>
  </Tabs>
);
