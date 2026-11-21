import { Package, Store } from "lucide-react";
import { rupiah } from "@/lib/api";
import { DeliverySchedule } from "@/components/DeliverySchedule";
import { BRAND } from "@/config/brand";

export const CourierSection = ({ couriers, courier, setCourier, ratesLoading, hasFresh, hasCold, schedule, setSchedule, payment, po = false }) => (
  <section>
    <h4 className="font-semibold text-sm mb-2">Jasa Kirim</h4>
    <p className="text-[11px] text-muted-foreground mb-2" data-testid="courier-note">
      Kurir Toko: Rp10.000 untuk 5 km pertama, khusus {BRAND.city.name}. Tandai lokasi di peta agar ongkir dihitung dari jarak.
    </p>
    {(hasFresh || hasCold) ? (
      <p className="text-[11px] text-sky-700 mb-2" data-testid="cold-courier-note">Keranjang berisi produk beku, jadi hanya bisa dikirim dengan Kurir Toko.</p>
    ) : (
      <p className="text-[11px] text-muted-foreground mb-2">Produk kering bisa dikirim ke luar kota dengan JNE / J&T.</p>
    )}
    {payment === "cod" && <p className="text-[11px] text-emerald-700 mb-2" data-testid="cod-courier-note">COD hanya bisa dengan Kurir Toko.</p>}
    {ratesLoading && <p className="text-[11px] text-emerald-600 mb-2">Menghitung ongkir...</p>}
    <div className="grid grid-cols-2 gap-2">
      {couriers.length === 0 && (
        <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3" data-testid="courier-unavailable">
          {(hasFresh || hasCold) ? `Produk beku hanya dikirim Kurir Toko untuk alamat di ${BRAND.city.name}.` : `COD hanya untuk alamat di ${BRAND.city.name}. Pilih QRIS atau transfer untuk JNE / J&T.`}
        </p>
      )}
      {couriers.map((c) => (
        <button key={c.code} data-testid={`courier-option-${c.code}`} onClick={() => setCourier(c)}
          className={`text-left p-3 rounded-xl border-2 transition-all ${courier?.code === c.code ? "border-primary bg-emerald-50" : "border-slate-200"}`}>
          <div className="flex items-center gap-1.5">
            {c.code === "toko" ? <Store className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-slate-500" />}
            <span className="font-semibold text-sm">{c.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.service || c.eta}</p>
          <p className="text-sm font-bold text-primary mt-0.5">{rupiah(c.cost)}</p>
        </button>
      ))}
    </div>
    {po && <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5 mt-2" data-testid="po-courier-note">Ada produk Pre Order H+1: dikirim paling cepat besok.</p>}
    {courier?.type === "instan" && <DeliverySchedule key={po ? "po" : "now"} value={schedule} onChange={setSchedule} po={po} />}
  </section>
);
