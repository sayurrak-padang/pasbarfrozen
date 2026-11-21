import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Minus, Plus, Trash2, Printer, Banknote, QrCode, Landmark, CreditCard, ReceiptText, RotateCcw, CheckCircle2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { printReceipt, PAY_LABEL } from "@/lib/receipt";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const PAYS = [["cash", Banknote], ["qris", QrCode], ["transfer", Landmark], ["debit", CreditCard]];
const PREF = "rsp_kasir_pref";
const loadPref = () => { try { return { paper: "58", autoPrint: true, ...JSON.parse(localStorage.getItem(PREF) || "{}") }; } catch { return { paper: "58", autoPrint: true }; } };
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const errMsg = (e) => e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal";

// Harga normal kasir = harga toko bila diisi; kalau kosong/0 ikut harga web (sudah termasuk diskon produk).
const webPrice = (p, v) => v ? (p.discount ? Math.round(v.price * (1 - p.discount / 100)) : v.price) : (p.final_price || p.price);
const storePrice = (p, v) => (v ? v.store_price : p.store_price) || 0;
const unitPrice = (p, v) => storePrice(p, v) || webPrice(p, v);
const hasStorePrice = (p) => p.variants?.length ? p.variants.some((v) => v.store_price) : !!p.store_price;
const stockOf = (p, v) => (v ? v.stock : p.stock) || 0;

// Daftar produk dari katalog (sama dengan data produk di web).
const ProductPicker = ({ products, onAdd, active }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => { if (active) ref.current?.focus(); }, [active]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => !p.archived && (!t || p.name.toLowerCase().includes(t) || p.product_id.toLowerCase() === t)).slice(0, 60);
  }, [products, q]);
  const pick = (p) => {
    if (p.variants?.length) { setOpen(open === p.product_id ? null : p.product_id); return; }
    onAdd(p, null);
  };
  const enter = (e) => {
    if (e.key !== "Enter" || !list.length) return;
    e.preventDefault();
    pick(list[0]);
    if (!list[0].variants?.length) setQ("");
  };
  return (
    <section className="bg-white rounded-2xl border p-3 flex flex-col min-h-0" data-testid="kasir-products">
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={enter} placeholder="Cari / scan produk lalu Enter" className="pl-9 h-11" data-testid="kasir-search" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto lg:max-h-[calc(100vh-15rem)] pr-1">
        {list.map((p) => {
          const st = p.variants?.length ? p.variants.reduce((a, v) => a + (v.stock || 0), 0) : p.stock || 0;
          return (
            <div key={p.product_id} className={`rounded-xl border text-left overflow-hidden ${st <= 0 ? "opacity-50" : ""} ${open === p.product_id ? "col-span-2 sm:col-span-3 xl:col-span-4 border-primary" : ""}`}>
              <button type="button" onClick={() => pick(p)} className="w-full flex gap-2 p-2 hover:bg-emerald-50 text-left" data-testid={`kasir-product-${p.product_id}`}>
                <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold line-clamp-3 leading-tight">{p.name}</span>
                  <span className="block text-xs text-primary font-bold mt-0.5">{p.variants?.length ? `${p.variants.length} varian` : rupiah(unitPrice(p))}
                    {hasStorePrice(p) && <span className="ml-1 align-middle text-[9px] font-semibold uppercase rounded bg-emerald-100 text-emerald-800 px-1 py-px" data-testid={`kasir-store-badge-${p.product_id}`}>Harga toko</span>}</span>
                  <span className={`block text-[10px] ${st <= 0 ? "text-red-600" : "text-muted-foreground"}`}>Stok {st}</span>
                </span>
              </button>
              {open === p.product_id && (
                <div className="flex flex-wrap gap-1.5 p-2 pt-0" data-testid={`kasir-variants-${p.product_id}`}>
                  {p.variants.map((v) => (
                    <button key={v.variant_id} type="button" disabled={!v.stock} onClick={() => { onAdd(p, v); setOpen(null); }}
                      className="rounded-lg border px-2.5 py-1.5 text-xs hover:border-primary hover:bg-emerald-50 disabled:opacity-40" data-testid={`kasir-variant-${v.variant_id}`}>
                      <b>{v.name}</b> · {rupiah(unitPrice(p, v))}{v.store_price ? <span className="text-emerald-700"> (toko)</span> : null} <span className="text-muted-foreground">(stok {v.stock || 0})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-8">Produk tidak ditemukan.</p>}
      </div>
    </section>
  );
};

const SaleDone = ({ sale, onClose, onPrint }) => (
  <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-sm" aria-describedby={undefined} data-testid="kasir-done">
      <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" /> Transaksi berhasil</DialogTitle>
      {sale && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
            <p className="flex justify-between"><span>No. struk</span><b className="font-mono">{sale.sale_id}</b></p>
            <p className="flex justify-between"><span>Total</span><b>{rupiah(sale.total)}</b></p>
            <p className="flex justify-between"><span>{PAY_LABEL[sale.payment_method]}</span><span>{rupiah(sale.cash_received)}</span></p>
            {sale.payment_method === "cash" && <p className="flex justify-between text-lg font-extrabold text-primary" data-testid="kasir-change"><span>Kembalian</span><span>{rupiah(sale.change)}</span></p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onPrint} className="gap-1" data-testid="kasir-print"><Printer className="w-4 h-4" /> Cetak Struk</Button>
            <Button onClick={onClose} data-testid="kasir-new">Transaksi Baru</Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
);

const History = ({ store, pref, active }) => {
  const qc = useQueryClient();
  const d = today();
  const { data } = useQuery({ queryKey: ["pos-sales", d, d], queryFn: async () => (await api.get("/admin/pos/sales", { params: { start: d, end: d } })).data, enabled: active, refetchInterval: 60000 });
  const voidSale = async (x) => {
    const reason = window.prompt(`Batalkan transaksi ${x.sale_id} (${rupiah(x.total)})? Stok akan dikembalikan.\nAlasan:`);
    if (reason === null) return;
    try { await api.post(`/admin/pos/sales/${x.sale_id}/void`, { reason }); toast.success("Transaksi dibatalkan, stok dikembalikan"); qc.invalidateQueries({ queryKey: ["pos-sales"] }); qc.invalidateQueries({ queryKey: ["admin-products"] }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  if (!data) return null;
  const s = data.summary;
  return (
    <section className="bg-white rounded-2xl border" data-testid="kasir-history">
      <div className="p-4 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="font-semibold flex items-center gap-2"><ReceiptText className="w-4 h-4" /> Transaksi Kasir Hari Ini</h3>
        <p className="text-sm text-muted-foreground">{s.transactions} transaksi · <b className="text-primary" data-testid="kasir-today-total">{rupiah(s.total)}</b>
          {data.by_payment.map((b) => <span key={b.method}> · {b.label} {rupiah(b.total)}</span>)}</p>
      </div>
      <div className="divide-y max-h-80 overflow-y-auto">
        {data.sales.map((x) => (
          <div key={x.sale_id} className={`flex items-center gap-3 px-4 py-2 text-sm ${x.status === "void" ? "opacity-50" : ""}`} data-testid={`kasir-sale-${x.sale_id}`}>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs">{x.sale_id} {x.status === "void" && <span className="ml-1 text-[10px] font-sans font-bold text-red-600">DIBATALKAN</span>}</p>
              <p className="text-[11px] text-muted-foreground truncate">{new Date(x.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {x.items.length} barang · {PAY_LABEL[x.payment_method]} · {x.cashier}</p>
            </div>
            <p className="font-semibold tabular-nums">{rupiah(x.total)}</p>
            <button onClick={() => printReceipt(x, store, pref.paper)} className="p-2 rounded-lg hover:bg-slate-100" title="Cetak ulang" data-testid={`kasir-reprint-${x.sale_id}`}><Printer className="w-4 h-4" /></button>
            {x.status === "paid" && <button onClick={() => voidSale(x)} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Batalkan" data-testid={`kasir-void-${x.sale_id}`}><RotateCcw className="w-4 h-4" /></button>}
          </div>
        ))}
        {data.sales.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada transaksi hari ini.</p>}
      </div>
    </section>
  );
};

export const AdminKasir = ({ products, active = true }) => {
  const qc = useQueryClient();
  const { data: store = {} } = useQuery({ queryKey: ["admin-store-settings"], queryFn: async () => (await api.get("/admin/settings/store")).data, enabled: active, staleTime: 10 * 60 * 1000 });
  const [cart, setCart] = useState([]);
  const [pay, setPay] = useState("cash");
  const [cash, setCash] = useState("");
  const [discount, setDiscount] = useState("");
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [pref, setPrefState] = useState(loadPref);
  const [showPref, setShowPref] = useState(false);
  const setPref = (p) => { const n = { ...pref, ...p }; setPrefState(n); try { localStorage.setItem(PREF, JSON.stringify(n)); } catch { /* abaikan */ } };

  const key = (pid, vid) => `${pid}|${vid || ""}`;
  const add = (p, v) => {
    const k = key(p.product_id, v?.variant_id);
    const max = stockOf(p, v);
    setCart((c) => {
      const ex = c.find((x) => x.key === k);
      if ((ex?.quantity || 0) + 1 > max) { toast.error(`Stok ${p.name}${v ? ` (${v.name})` : ""} tinggal ${max}`); return c; }
      if (ex) return c.map((x) => x.key === k ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { key: k, product_id: p.product_id, variant_id: v?.variant_id || null, name: p.name, variant_name: v?.name, image: p.image, price: unitPrice(p, v), normal: unitPrice(p, v), quantity: 1, max }];
    });
  };
  const setQty = (k, q) => setCart((c) => c.flatMap((x) => x.key !== k ? [x] : q <= 0 ? [] : [{ ...x, quantity: Math.min(q, x.max) }]));
  const setPrice = (k, v) => setCart((c) => c.map((x) => x.key === k ? { ...x, price: Math.max(0, Number(v) || 0) } : x));

  const subtotal = cart.reduce((a, x) => a + x.price * x.quantity, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - disc;
  const cashN = Number(cash) || 0;
  const change = cashN - total;
  const quick = [...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])].filter((n) => n > 0).slice(0, 4);

  const reset = () => { setCart([]); setCash(""); setDiscount(""); setCustomer(""); setNote(""); setPay("cash"); };
  const checkout = async () => {
    if (!cart.length) { toast.error("Keranjang kasir masih kosong"); return; }
    if (pay === "cash" && cashN < total) { toast.error("Uang tunai kurang"); return; }
    setBusy(true);
    try {
      const { data: sale } = await api.post("/admin/pos/sales", {
        items: cart.map((x) => ({ product_id: x.product_id, variant_id: x.variant_id, quantity: x.quantity, price: x.price !== x.normal ? x.price : null })),
        payment_method: pay, cash_received: pay === "cash" ? cashN : 0, discount: disc, customer_name: customer, note,
      });
      setDone(sale);
      reset();
      if (pref.autoPrint) printReceipt(sale, store, pref.paper);
      qc.invalidateQueries({ queryKey: ["pos-sales"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="admin-kasir">
      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <ProductPicker products={products} onAdd={add} active={active} />
        <section className="bg-white rounded-2xl border p-3 space-y-3 lg:sticky lg:top-20" data-testid="kasir-cart">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Keranjang Kasir {cart.length > 0 && <span className="text-muted-foreground font-normal">({cart.reduce((a, x) => a + x.quantity, 0)})</span>}</h3>
            <div className="flex items-center gap-1">
              {cart.length > 0 && <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={reset} data-testid="kasir-clear">Kosongkan</Button>}
              <button onClick={() => setShowPref(!showPref)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Pengaturan printer" data-testid="kasir-pref-toggle"><Settings2 className="w-4 h-4" /></button>
            </div>
          </div>
          {showPref && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-2" data-testid="kasir-pref">
              <p className="font-semibold text-xs">Printer struk</p>
              <div className="flex gap-2">
                {["58", "80"].map((p) => <Button key={p} size="sm" variant={pref.paper === p ? "default" : "outline"} onClick={() => setPref({ paper: p })} data-testid={`kasir-paper-${p}`}>Kertas {p} mm</Button>)}
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={pref.autoPrint} onChange={(e) => setPref({ autoPrint: e.target.checked })} data-testid="kasir-autoprint" /> Cetak otomatis setelah bayar</label>
              <p className="text-[11px] text-muted-foreground">Pilih printer kasir di jendela cetak. Atur margin "Tidak ada" dan ukuran kertas sesuai printer (58/80 mm).</p>
            </div>
          )}
          <div className="divide-y max-h-[40vh] overflow-y-auto -mx-1 px-1">
            {cart.map((x) => (
              <div key={x.key} className="py-2 flex gap-2 items-center" data-testid={`kasir-line-${x.product_id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-1">{x.name}{x.variant_name ? ` · ${x.variant_name}` : ""}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[11px] text-muted-foreground">@</span>
                    <input type="number" min={0} value={x.price} onChange={(e) => setPrice(x.key, e.target.value)} className={`w-24 h-7 rounded-md border px-2 text-xs ${x.price !== x.normal ? "border-amber-400 bg-amber-50" : ""}`} aria-label="Harga satuan" data-testid={`kasir-price-${x.product_id}`} />
                    <span className="text-xs font-bold ml-auto tabular-nums">{rupiah(x.price * x.quantity)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setQty(x.key, x.quantity - 1)} className="w-7 h-7 rounded-full border flex items-center justify-center" aria-label="Kurangi" data-testid={`kasir-minus-${x.product_id}`}>{x.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}</button>
                  <input type="number" min={1} value={x.quantity} onChange={(e) => setQty(x.key, Number(e.target.value) || 1)} className="w-10 h-7 text-center text-sm font-bold border rounded-md" aria-label="Jumlah" data-testid={`kasir-qty-${x.product_id}`} />
                  <button onClick={() => setQty(x.key, x.quantity + 1)} disabled={x.quantity >= x.max} className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40" aria-label="Tambah" data-testid={`kasir-plus-${x.product_id}`}><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Klik produk di kiri untuk menambahkan.</p>}
          </div>

          <div className="border-t pt-3 space-y-2 text-sm">
            <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{rupiah(subtotal)}</span></p>
            <div className="flex items-center justify-between gap-2"><span>Diskon (Rp)</span>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-32 h-8 text-right" data-testid="kasir-discount" /></div>
            <p className="flex justify-between text-xl font-extrabold"><span>Total</span><span className="text-primary tabular-nums" data-testid="kasir-total">{rupiah(total)}</span></p>
          </div>

          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Metode bayar">
            {PAYS.map(([k, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={pay === k} onClick={() => setPay(k)} data-testid={`kasir-pay-${k}`}
                className={`rounded-xl border-2 py-2 flex flex-col items-center gap-0.5 text-[11px] font-semibold ${pay === k ? "border-primary bg-emerald-50 text-primary" : "border-slate-200"}`}>
                <Icon className="w-4 h-4" />{PAY_LABEL[k].split("/")[0]}
              </button>
            ))}
          </div>
          {pay === "cash" && (
            <div className="space-y-1.5">
              <Input type="number" min={0} value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Uang diterima (Rp)" className="h-11 text-base font-bold" data-testid="kasir-cash" />
              <div className="flex flex-wrap gap-1.5">
                {quick.map((n, i) => <button key={n} type="button" onClick={() => setCash(String(n))} className="rounded-full border px-3 py-1 text-xs hover:bg-slate-50" data-testid={`kasir-quick-${i}`}>{i === 0 ? "Uang pas" : rupiah(n)}</button>)}
              </div>
              {cashN > 0 && <p className={`flex justify-between font-bold ${change < 0 ? "text-red-600" : "text-primary"}`} data-testid="kasir-change-preview"><span>{change < 0 ? "Kurang" : "Kembalian"}</span><span>{rupiah(Math.abs(change))}</span></p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nama pelanggan (opsional)" className="h-9 text-xs" data-testid="kasir-customer" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className="h-9 text-xs" data-testid="kasir-note" />
          </div>
          <Button className="w-full h-12 text-base font-bold gap-2" disabled={busy || !cart.length || (pay === "cash" && cashN < total)} onClick={checkout} data-testid="kasir-checkout">
            <Printer className="w-5 h-5" /> Bayar {pref.autoPrint ? "& Cetak" : ""} {total > 0 && rupiah(total)}
          </Button>
        </section>
      </div>
      <History store={store} pref={pref} active={active} />
      <SaleDone sale={done} onClose={() => setDone(null)} onPrint={() => printReceipt(done, store, pref.paper)} />
    </div>
  );
};
