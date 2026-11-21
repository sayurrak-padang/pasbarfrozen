import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressMap } from "@/components/AddressMap";
import { RegionFields } from "@/components/RegionFields";
import { IncompleteAddressBanner, isAddressIncomplete } from "@/components/ShippingHints";

const SavedAddresses = ({ saved, addrId, onPick }) => (
  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
    {saved.map((a) => (
      <button key={a.address_id} type="button" data-testid={`checkout-address-${a.address_id}`} onClick={() => onPick(a)}
        className={`shrink-0 text-left max-w-[180px] rounded-xl border-2 px-3 py-2 ${addrId === a.address_id ? "border-primary bg-emerald-50" : "border-slate-200"}`}>
        <p className="text-xs font-bold">{a.label}{a.lat != null && <MapPin className="inline w-3 h-3 ml-1 text-primary" />}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{a.full}</p>
      </button>
    ))}
  </div>
);

const PinPicker = ({ addr, setAddr }) => (addr.lat != null ? (
  <p className="text-[11px] text-emerald-600 flex items-center gap-1" data-testid="checkout-pin-ok"><MapPin className="w-3 h-3" /> Titik lokasi sudah ditandai
    <button type="button" className="underline ml-1" data-testid="checkout-pin-reset" onClick={() => setAddr({ ...addr, lat: null, lng: null })}>ubah</button></p>
) : (
  <div data-testid="checkout-pin-required">
    <p className="text-[11px] text-amber-600 mb-1">Kurir instan wajib titik lokasi: tandai alamat Anda di peta.</p>
    <AddressMap hideSearch lat={addr.lat} lng={addr.lng} onChange={(v) => setAddr((p) => ({ ...p, lat: v.lat, lng: v.lng, ...(v.full && !p.full ? { full: v.full } : {}), ...(v.postal && !p.postal ? { postal: v.postal } : {}) }))} />
  </div>
));

export const AddressSection = ({ user, saved, addrId, addr, setAddr, onPick, instant, onManage, onFixAddress }) => {
  const field = (k) => ({ value: addr[k], onChange: (e) => setAddr({ ...addr, [k]: e.target.value }) });
  const picked = saved.find((a) => a.address_id === addrId);
  return (
    <section>
      <h4 className="font-semibold text-sm mb-2 flex items-center justify-between">
        Alamat Pengiriman
        {user && <button type="button" data-testid="manage-address-link" onClick={onManage} className="text-xs text-primary font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {saved.length ? "Kelola alamat" : "Tambah alamat via peta"}</button>}
      </h4>
      {saved.length > 0 && <SavedAddresses saved={saved} addrId={addrId} onPick={onPick} />}
      {isAddressIncomplete(picked) && <div className="mb-2"><IncompleteAddressBanner testid="checkout-incomplete-banner" onFix={() => onFixAddress(picked.address_id)} /></div>}
      <div className="space-y-2">
        <Input data-testid="addr-name" placeholder="Nama penerima" {...field("name")} />
        <Input data-testid="addr-phone" placeholder="No. HP" {...field("phone")} />
        <Textarea data-testid="addr-full" placeholder="Alamat lengkap" rows={2} {...field("full")} />
        <RegionFields testid="addr-region" locate={instant} required={!instant} value={addr} onChange={(v) => setAddr((p) => ({ ...p, ...v }))} />
        {instant && <PinPicker addr={addr} setAddr={setAddr} />}
      </div>
    </section>
  );
};
