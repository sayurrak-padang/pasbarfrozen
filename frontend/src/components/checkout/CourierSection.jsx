import { Zap, Package, Store } from "lucide-react";
import { rupiah } from "@/lib/api";
import { DeliverySchedule } from "@/components/DeliverySchedule";
import { BRAND } from "@/config/brand";

export const CourierSection = ({ couriers, courier, setCourier, ratesLoading, hasFresh, hasCold, schedule, setSchedule, payment, po = false }) => (
  <section>
    <h4 className="font-semibold text-sm mb-2">Jasa Kirim</h4>
    {payment === "cod" ? (
      <p className="text-[11px] text-emerald-700 mb-2" data-testid="cod-courier-note">Pembayaran COD diantar oleh Kurir Toko (khusus {BRAND.city.name}). Ongkir setara tarif Grab/Gojek.</p>
    ) : (
      <p className="text-[11px] text-muted-foreground mb-2" data-testid="paid-courier-note">Grab/Gojek/JNE/J&T/Paxel tersedia untuk pembayaran QRIS, Virtual Account & Saldo.</p>
    )}
    {ratesLoading && <p className="text-[11px] text-emerald-600 mb-2">Mengambil tarif real-time...</p>}
    {courier?.source === "biteship" ? (
      <p className="text-[11px] text-emerald-600 mb-2">✓ Tarif real-time Biteship (berdasarkan kode pos)</p>
    ) : (
      <p className="text-[11px] text-muted-foreground mb-2">{hasFresh || hasCold ? "Tarif kurir instan (Grab/Gojek) berlaku flat." : "Isi kecamatan & kode pos untuk tarif real-time Biteship."}</p>
    )}
    {hasFresh && <p className="text-[11px] text-amber-600 mb-2">Produk segar hanya bisa kurir instan.</p>}
    {!hasFresh && hasCold && <p className="text-[11px] text-sky-700 mb-2" data-testid="cold-courier-note">Produk dingin (frozen/ikan/ayam/daging) dikirim dengan kurir instan atau Paxel berpendingin.</p>}
    <div className="grid grid-cols-2 gap-2">
      {couriers.length === 0 && payment === "cod" && (
        <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3" data-testid="cod-unavailable">
          Kurir Toko (COD) hanya untuk alamat di {BRAND.city.name}. Pilih wilayah kecamatan di {BRAND.city.name}, atau bayar dengan QRIS / VA / Saldo untuk kurir lain.
        </p>
      )}
      {couriers.map((c) => (
        <button key={c.code} data-testid={`courier-option-${c.code}`} onClick={() => setCourier(c)}
          className={`text-left p-3 rounded-xl border-2 transition-all ${courier?.code === c.code ? "border-primary bg-emerald-50" : "border-slate-200"}`}>
          <div className="flex items-center gap-1.5">
            {c.code === "toko" ? <Store className="w-4 h-4 text-primary" /> : c.type === "instan" ? <Zap className="w-4 h-4 text-amber-500" /> : <Package className="w-4 h-4 text-slate-500" />}
            <span className="font-semibold text-sm">{c.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.eta}</p>
          <p className="text-sm font-bold text-primary mt-0.5">{rupiah(c.cost)}</p>
        </button>
      ))}
    </div>
    {po && <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5 mt-2" data-testid="po-courier-note">Ada produk Pre Order H+1: dikirim paling cepat besok.</p>}
    {courier?.type === "instan" && <DeliverySchedule key={po ? "po" : "now"} value={schedule} onChange={setSchedule} po={po} />}
  </section>
);
