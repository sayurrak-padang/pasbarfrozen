import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Search } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl, rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-");

const WalletDialog = ({ customer, onClose }) => {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { data: txs = [] } = useQuery({ queryKey: ["cust-wallet", customer?.user_id], enabled: !!customer, queryFn: async () => (await api.get(`/admin/customers/${customer.user_id}/wallet`)).data });
  const save = async (sign) => {
    try {
      await api.post(`/admin/customers/${customer.user_id}/wallet`, { amount: sign * Math.abs(Number(amount)), note });
      toast.success("Saldo diperbarui"); setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin-customers"] }); qc.invalidateQueries({ queryKey: ["cust-wallet", customer.user_id] });
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined} data-testid="customer-wallet-dialog">
        <DialogHeader><DialogTitle>Saldo {customer?.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Input data-testid="wallet-adjust-amount" type="number" placeholder="Jumlah (Rp)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input data-testid="wallet-adjust-note" placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!Number(amount)} onClick={() => save(1)} data-testid="wallet-adjust-add">Tambah Saldo</Button>
          <Button className="flex-1" variant="outline" disabled={!Number(amount)} onClick={() => save(-1)} data-testid="wallet-adjust-sub">Kurangi Saldo</Button>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y text-sm">
          {txs.map((t) => <div key={t.tx_id} className="flex justify-between py-2"><span className="text-xs">{t.note}<br /><span className="text-muted-foreground">{new Date(t.created_at).toLocaleString("id-ID")}</span></span><b className={t.amount > 0 ? "text-emerald-600" : "text-red-500"}>{rupiah(t.amount)}</b></div>)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AdminCustomers = () => {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const { data: list = [] } = useQuery({ queryKey: ["admin-customers"], queryFn: async () => (await api.get("/admin/customers")).data });
  const rows = list.filter((c) => `${c.name} ${c.email} ${c.phone || ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3" data-testid="admin-customers">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input data-testid="customer-search" className="pl-9" placeholder="Cari nama / email / HP" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="text-sm text-muted-foreground" data-testid="customer-count">{rows.length} konsumen</span>
      </div>
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Konsumen</th><th className="p-3">WhatsApp</th><th className="p-3">Login</th><th className="p-3">Pesanan</th><th className="p-3">Belanja</th><th className="p-3">Saldo</th><th className="p-3">Bergabung</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.user_id} className="border-t" data-testid={`customer-row-${c.user_id}`}>
                <td className="p-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.email}</p></td>
                <td className="p-3 text-xs">{c.phone || "-"}{c.phone_verified && <span className="ml-1 text-emerald-600">✓</span>}</td>
                <td className="p-3 text-xs">{c.picture ? "Google" : "Email"}</td>
                <td className="p-3">{c.orders}</td><td className="p-3">{rupiah(c.spend)}</td>
                <td className="p-3"><button className="font-semibold text-primary underline" onClick={() => setSel(c)} data-testid={`customer-wallet-${c.user_id}`}>{rupiah(c.balance)}</button></td>
                <td className="p-3 text-xs">{fmt(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WalletDialog customer={sel} onClose={() => setSel(null)} />
    </div>
  );
};

const ResolveForm = ({ c }) => {
  const qc = useQueryClient();
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");
  const act = async (status) => {
    try {
      await api.post(`/admin/complaints/${c.complaint_id}/resolve`, { status, refund_amount: Number(refund) || 0, admin_note: note });
      toast.success("Komplain diproses"); qc.invalidateQueries({ queryKey: ["admin-complaints"] });
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <div className="mt-3 grid sm:grid-cols-[140px_1fr_auto_auto] gap-2">
      <Input data-testid={`complaint-refund-${c.complaint_id}`} type="number" placeholder="Refund (Rp)" value={refund} onChange={(e) => setRefund(e.target.value)} />
      <Input data-testid={`complaint-note-${c.complaint_id}`} placeholder="Catatan untuk konsumen" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" className="h-10" onClick={() => act("resolved")} data-testid={`complaint-resolve-${c.complaint_id}`}>Selesaikan</Button>
      <Button size="sm" variant="outline" className="h-10" onClick={() => act("rejected")} data-testid={`complaint-reject-${c.complaint_id}`}>Tolak</Button>
    </div>
  );
};

export const AdminComplaints = () => {
  const { data: list = [] } = useQuery({ queryKey: ["admin-complaints"], queryFn: async () => (await api.get("/admin/complaints")).data });
  if (!list.length) return <p className="text-sm text-muted-foreground text-center py-10">Belum ada komplain.</p>;
  return (
    <div className="space-y-3" data-testid="admin-complaints">
      {list.map((c) => (
        <div key={c.complaint_id} className="bg-white rounded-2xl border p-4" data-testid={`complaint-${c.complaint_id}`}>
          <div className="flex flex-wrap items-center gap-2">
            <b>{c.complaint_id}</b><span className="text-xs text-muted-foreground">Pesanan {c.order_id} · {c.user_name} · {fmt(c.created_at)}</span>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.status === "open" ? "bg-amber-100 text-amber-700" : c.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>{c.status === "open" ? "Baru" : c.status === "resolved" ? "Selesai" : "Ditolak"}</span>
          </div>
          <p className="text-sm font-semibold mt-2">{c.reason}</p>
          {c.items?.length > 0 && <p className="text-xs text-muted-foreground">Produk: {c.items.join(", ")}</p>}
          {c.description && <p className="text-sm mt-1">{c.description}</p>}
          <div className="flex gap-2 mt-2">{c.photos?.map((p) => <a key={p} href={fileUrl(p)} target="_blank" rel="noreferrer"><img src={fileUrl(p)} alt="" className="w-16 h-16 rounded-lg object-cover" /></a>)}</div>
          {c.status === "open" ? <ResolveForm c={c} /> : <p className="text-xs mt-2 text-muted-foreground">Refund {rupiah(c.refund_amount)} ke saldo{c.admin_note ? ` · ${c.admin_note}` : ""}</p>}
        </div>
      ))}
    </div>
  );
};

export const AdminCategories = () => {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const upload = async (slug, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd);
      await api.patch(`/admin/categories/${slug}`, { image: data.url });
      toast.success("Foto kategori diganti"); qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal"); }
    e.target.value = "";
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="admin-categories">
      {cats.map((c) => (
        <label key={c.slug} className="relative rounded-2xl overflow-hidden border bg-white cursor-pointer group" data-testid={`admin-category-${c.slug}`}>
          <img src={fileUrl(c.image)} alt={c.name} className="w-full aspect-square object-cover" />
          <span className="absolute inset-0 bg-black/50 text-white text-xs flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-4 h-4" /> Ganti foto</span>
          <p className="text-xs font-semibold p-2 text-center">{c.name}</p>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(c.slug, e)} data-testid={`admin-category-input-${c.slug}`} />
        </label>
      ))}
    </div>
  );
};

export const CancelRequestPanel = ({ order }) => {
  const qc = useQueryClient();
  const cr = order.cancel_request;
  if (!cr || cr.status !== "pending") return null;
  const decide = async (approve) => {
    try { await api.post(`/admin/orders/${order.order_id}/cancel-request`, { approve }); toast.success(approve ? "Pembatalan disetujui" : "Pembatalan ditolak"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm flex flex-wrap items-center gap-2" data-testid={`admin-cancel-request-${order.order_id}`}>
      <span className="flex-1">Konsumen mengajukan pembatalan{cr.reason ? `: "${cr.reason}"` : ""}</span>
      <Button size="sm" onClick={() => decide(true)} data-testid={`approve-cancel-${order.order_id}`}>Setujui</Button>
      <Button size="sm" variant="outline" onClick={() => decide(false)} data-testid={`reject-cancel-${order.order_id}`}>Tolak</Button>
    </div>
  );
};

export const VariantEditor = ({ variants, onChange }) => {
  const set = (i, k, v) => onChange(variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2" data-testid="variant-editor">
      <div className="flex items-center justify-between"><p className="text-xs font-medium">Varian (opsional)</p>
        <button type="button" className="text-xs text-primary font-semibold" data-testid="add-variant-btn" onClick={() => onChange([...variants, { variant_id: `v${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`, name: "", price: "", hpp: 0, store_price: "", stock: 0 }])}>+ Tambah varian</button></div>
      {variants.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_88px_76px_80px_60px_64px_24px] gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
          <span>Nama</span><span>Harga</span><span>HPP</span><span>Hrg toko</span><span>Stok</span><span>Gram</span><span />
        </div>
      )}
      {variants.map((v, i) => (
        <div key={v.variant_id || `${v.name}-${i}`} className="grid grid-cols-[minmax(0,1fr)_88px_76px_80px_60px_64px_24px] gap-1.5 items-center">
          <Input className="h-8" placeholder="Nama (500gr)" value={v.name} onChange={(e) => set(i, "name", e.target.value)} data-testid={`variant-name-${i}`} />
          <Input className="h-8" type="number" placeholder="Harga" value={v.price} onChange={(e) => set(i, "price", e.target.value)} data-testid={`variant-price-${i}`} />
          <Input className="h-8" type="number" placeholder="HPP" value={v.hpp} onChange={(e) => set(i, "hpp", e.target.value)} data-testid={`variant-hpp-${i}`} />
          <Input className="h-8" type="number" min={0} placeholder="Web" title="Harga toko untuk kasir (kosong = ikut harga web)" value={v.store_price || ""} onChange={(e) => set(i, "store_price", e.target.value)} data-testid={`variant-store-price-${i}`} />
          <Input className="h-8" type="number" placeholder="Stok" value={v.stock} onChange={(e) => set(i, "stock", e.target.value)} data-testid={`variant-stock-${i}`} />
          <Input className="h-8" type="number" placeholder="Gram" value={v.weight || ""} onChange={(e) => set(i, "weight", e.target.value)} data-testid={`variant-weight-${i}`} />
          <button type="button" className="text-red-500 text-sm" onClick={() => onChange(variants.filter((_, j) => j !== i))} data-testid={`variant-remove-${i}`}>×</button>
        </div>
      ))}
      {variants.length > 0 && <p className="text-[11px] text-muted-foreground">Harga & stok produk otomatis mengikuti varian. Harga toko kosong = kasir pakai harga web.</p>}
    </div>
  );
};

export const ComplaintNote = ({ text }) => <Textarea value={text} readOnly />;
