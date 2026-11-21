import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Link2, Wallet, MousePointerClick, ShoppingBag, Search, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { shareLink } from "@/lib/ref";
import { makeStoryCard, shareOrDownload } from "@/lib/promoCard";
import { WithdrawPanel } from "@/components/Withdrawals";
import { AffiliateLeaderboard } from "@/components/AffiliateLeaderboard";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";

const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success("Link disalin")).catch(() => toast.error("Gagal menyalin"));
const STATUS = { pending: ["Menunggu pesanan selesai", "bg-amber-100 text-amber-700"], paid: ["Masuk Saldo Komisi", "bg-emerald-100 text-emerald-700"], cancelled: ["Batal", "bg-red-100 text-red-600"] };

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="glass rounded-2xl p-4" data-testid={testid}>
    <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</p>
    <p className="text-xl font-extrabold mt-1">{value}</p>
  </div>
);

const ProductLinks = ({ code }) => {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const promo = async (p) => {
    setBusy(p.product_id);
    try {
      const link = shareLink(code, p.product_id);
      const blob = await makeStoryCard({ product: p, code, link });
      const r = await shareOrDownload(blob, `promo-${p.product_id}.png`, `${p.name} - pesan di sini: ${link}`);
      if (r === "downloaded") toast.success("Kartu promo diunduh, siap diunggah ke Status WA / Story IG");
    } catch (e) { console.error(e); toast.error("Gagal membuat kartu promo"); }
    finally { setBusy(""); }
  };
  const { data: prods = [] } = useQuery({ queryKey: ["aff-products", q], queryFn: async () => (await api.get("/affiliate/products", { params: { search: q } })).data });
  return (
    <section className="glass rounded-2xl p-4 space-y-3" data-testid="affiliate-products">
      <h2 className="font-semibold">Link Produk</h2>
      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari produk berkomisi" value={q} onChange={(e) => setQ(e.target.value)} data-testid="affiliate-product-search" /></div>
      {prods.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center" data-testid="affiliate-products-empty">Belum ada produk berkomisi.</p> : (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1" data-testid="affiliate-products-list">
          {prods.map((p) => (
            <div key={p.product_id} className="snap-start shrink-0 w-40 border rounded-xl overflow-hidden flex flex-col hover:border-primary transition-colors" data-testid={`affiliate-product-${p.product_id}`}>
              <img src={p.image} alt="" className="w-full aspect-square object-cover bg-slate-100" loading="lazy" />
              <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{rupiah(p.final_price)}</p>
                <p className="text-[11px]">Komisi {p.pct}% ≈ <b className="text-primary">{rupiah(p.commission)}</b></p>
                <div className="mt-auto flex flex-col gap-1">
                  <button onClick={() => copy(shareLink(code, p.product_id))} className="h-8 rounded-lg border text-xs inline-flex items-center justify-center gap-1 hover:border-primary transition-colors" data-testid={`affiliate-copy-${p.product_id}`}><Copy className="w-3.5 h-3.5" /> Salin link</button>
                  <button onClick={() => promo(p)} disabled={busy === p.product_id} className="h-8 rounded-lg bg-primary text-white text-xs inline-flex items-center justify-center gap-1 disabled:opacity-60" data-testid={`affiliate-card-${p.product_id}`}><ImageDown className="w-3.5 h-3.5" /> {busy === p.product_id ? "Membuat..." : "Kartu promo"}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {prods.length > 0 && <p className="text-[11px] text-muted-foreground" data-testid="affiliate-products-hint">Geser ke samping untuk melihat semua {prods.length} produk</p>}
    </section>
  );
};

export default function AffiliatePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: me } = useQuery({ queryKey: ["affiliate-me"], queryFn: async () => (await api.get("/affiliate/me")).data, enabled: !!user });
  if (!me) return <div className="min-h-screen" />;
  const storeLink = shareLink(me.ref_code);
  return (
    <div className="min-h-screen" data-testid="affiliate-page">
      <div className="border-b sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-white/70">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1" data-testid="affiliate-back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold">Program Affiliate</h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-green-500 text-white p-5 space-y-2">
          <p className="text-sm opacity-90">Bagikan link toko atau produk. Komisi masuk ke Saldo Komisi setelah pesanan pembeli berstatus Selesai, lalu bisa dipindah ke Saldo atau ditarik ke rekening.</p>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl p-2">
            <Link2 className="w-4 h-4 shrink-0" /><span className="text-sm truncate flex-1" data-testid="affiliate-store-link">{storeLink}</span>
            <button onClick={() => copy(storeLink)} className="h-8 px-3 rounded-lg bg-white text-emerald-700 text-xs font-semibold" data-testid="affiliate-copy-store">Salin link toko</button>
          </div>
          <p className="text-xs opacity-80">Kode Anda: <b data-testid="affiliate-code">{me.ref_code}</b> · berlaku 30 hari sejak link dibuka</p>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={MousePointerClick} label="Kunjungan" value={me.clicks} testid="affiliate-clicks" />
          <Stat icon={ShoppingBag} label="Pesanan" value={me.orders} testid="affiliate-orders" />
          <Stat icon={Wallet} label="Komisi tertunda" value={rupiah(me.pending)} testid="affiliate-pending" />
          <Stat icon={Wallet} label="Total komisi cair" value={rupiah(me.paid)} testid="affiliate-paid" />
        </div>
        <AffiliateLeaderboard myCode={me.ref_code} />
        <ProductLinks code={me.ref_code} />
        <WithdrawPanel />
        <section className="glass rounded-2xl p-4" data-testid="affiliate-history">
          <h2 className="font-semibold mb-2">Riwayat Komisi</h2>
          {me.history.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Belum ada pesanan dari link Anda.</p> : <div className="max-h-80 overflow-y-auto pr-1" data-testid="affiliate-history-list">{me.history.map((h) => (
            <div key={h.order_id} className="flex items-center justify-between py-2 border-t first:border-0 text-sm" data-testid={`affiliate-history-${h.order_id}`}>
              <div><p className="font-mono text-xs">{h.order_id}</p><p className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString("id-ID")} · belanja {rupiah(h.subtotal)}</p></div>
              <div className="text-right"><p className="font-bold text-primary">{rupiah(h.amount)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS[h.commission_status][1]}`}>{STATUS[h.commission_status][0]}</span></div>
            </div>
          ))}</div>}
        </section>
      </div>
    </div>
  );
}
