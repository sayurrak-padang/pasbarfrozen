import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminWithdrawals } from "@/components/Withdrawals";
import { AffiliateLeaderboard } from "@/components/AffiliateLeaderboard";

const PctInput = ({ value, onSave, testid, allowEmpty = false }) => {
  const [v, setV] = useState(value ?? "");
  const submit = () => {
    if (v !== "" && (Number(v) < 0 || Number(v) > 50)) { toast.error("Komisi harus 0–50%"); return; }
    onSave(v === "" ? null : Number(v));
  };
  return (
    <div className="flex items-center gap-1">
      <Input type="number" min={0} max={50} step="0.5" className="w-20 h-8" value={v} placeholder={allowEmpty ? "ikut" : "0"} onChange={(e) => setV(e.target.value)} data-testid={testid} />
      <span className="text-xs">%</span>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={submit} data-testid={`${testid}-save`}><Save className="w-3.5 h-3.5" /></Button>
    </div>
  );
};

const ProductOverride = ({ onDone }) => {
  const [q, setQ] = useState("");
  const { data: hits = [] } = useQuery({ queryKey: ["aff-admin-search", q], enabled: q.trim().length >= 2,
    queryFn: async () => (await api.get("/products", { params: { search: q } })).data.slice(0, 8) });
  const save = async (pid, pct) => {
    try { await api.put(`/admin/affiliate/product/${pid}`, { pct }); toast.success("Komisi produk disimpan"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal"); }
  };
  return (
    <div className="space-y-2">
      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari produk untuk atur komisi khusus" value={q} onChange={(e) => setQ(e.target.value)} data-testid="aff-product-search" /></div>
      {q.trim().length >= 2 && hits.map((p) => (
        <div key={p.product_id} className="flex items-center gap-2 text-sm border rounded-xl p-2" data-testid={`aff-search-result-${p.product_id}`}>
          <img src={p.image} alt="" className="w-9 h-9 rounded object-cover" /><span className="flex-1 line-clamp-1">{p.name}</span>
          <PctInput value={p.affiliate_pct} allowEmpty onSave={(pct) => save(p.product_id, pct)} testid={`aff-search-pct-${p.product_id}`} />
        </div>
      ))}
    </div>
  );
};

export const AdminAffiliate = () => {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-affiliate"], queryFn: async () => (await api.get("/admin/affiliate")).data });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-affiliate"] });
  const saveCat = async (slug, pct) => {
    try { await api.put(`/admin/affiliate/category/${slug}`, { pct }); toast.success("Komisi kategori disimpan"); refresh(); }
    catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal"); }
  };
  const saveProd = async (pid, pct) => {
    try { await api.put(`/admin/affiliate/product/${pid}`, { pct }); toast.success("Disimpan"); refresh(); }
    catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal"); }
  };
  if (!data) return null;
  return (
    <div className="space-y-4 max-w-5xl" data-testid="admin-affiliate">
      <p className="text-xs text-muted-foreground">Komisi = % dari harga barang (sebelum ongkir & voucher). Masuk ke saldo affiliate saat pesanan Selesai, batal jika pesanan dibatalkan. Komisi produk menimpa komisi kategori; kosongkan untuk ikut kategori.</p>
      <AffiliateLeaderboard />
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white border rounded-2xl p-4" data-testid="aff-categories">
          <h3 className="font-semibold mb-2">Komisi per Kategori</h3>
          <div className="divide-y max-h-[420px] overflow-y-auto">
            {data.categories.map((c) => (
              <div key={c.slug} className="flex items-center justify-between py-2 text-sm" data-testid={`aff-cat-${c.slug}`}>
                <span>{c.name}</span><PctInput key={`${c.slug}-${c.affiliate_pct}`} value={c.affiliate_pct} onSave={(p) => saveCat(c.slug, p)} testid={`aff-cat-pct-${c.slug}`} />
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white border rounded-2xl p-4 space-y-3" data-testid="aff-products">
          <h3 className="font-semibold">Komisi Khusus Produk</h3>
          <ProductOverride onDone={refresh} />
          <div className="divide-y">
            {data.overrides.map((p) => (
              <div key={p.product_id} className="flex items-center gap-2 py-2 text-sm" data-testid={`aff-override-${p.product_id}`}>
                <span className="flex-1 line-clamp-1">{p.name}</span>
                <PctInput key={`${p.product_id}-${p.affiliate_pct}`} value={p.affiliate_pct} allowEmpty onSave={(pct) => saveProd(p.product_id, pct)} testid={`aff-override-pct-${p.product_id}`} />
              </div>
            ))}
            {data.overrides.length === 0 && <p className="text-xs text-muted-foreground py-3">Belum ada komisi khusus produk.</p>}
          </div>
        </section>
      </div>
      <AdminWithdrawals />
      <section className="bg-white border rounded-2xl overflow-x-auto" data-testid="aff-leaderboard">
        <h3 className="font-semibold p-4 pb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Affiliate</h3>
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 text-xs text-muted-foreground text-left"><tr><th className="p-3">Nama</th><th className="p-3">Kode</th><th className="p-3">Pesanan</th><th className="p-3">Penjualan</th><th className="p-3">Tertunda</th><th className="p-3">Dibayar</th></tr></thead>
          <tbody>
            {data.affiliates.map((a) => (
              <tr key={a.user_id} className="border-t" data-testid={`aff-row-${a.user_id}`}><td className="p-3">{a.name}</td><td className="p-3 font-mono text-xs">{a.ref_code}</td><td className="p-3">{a.orders}</td>
                <td className="p-3">{rupiah(a.sales)}</td><td className="p-3 text-amber-700">{rupiah(a.pending)}</td><td className="p-3 font-semibold text-primary">{rupiah(a.paid)}</td></tr>
            ))}
            {data.affiliates.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada pesanan dari affiliate.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
};
