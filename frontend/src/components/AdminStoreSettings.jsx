import { useEffect, useState } from "react";
import { Store, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AddressMap } from "@/components/AddressMap";
import { OwnerPhones, TwilioBotGuide, BiteshipWebhookGuide } from "@/components/AdminWhatsApp";
import { BRAND } from "@/config/brand";

const EMPTY = { store_name: BRAND.name, contact_name: "", phone: "", address: "", postal: "", lat: null, lng: null, owner_phones: [] };

export const AdminStoreSettings = () => {
  const [f, setF] = useState(EMPTY);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { api.get("/admin/settings/store").then(({ data }) => setF({ ...EMPTY, ...data })); }, []);

  const onMap = (v) => setF((p) => ({ ...p, lat: v.lat, lng: v.lng, ...(v.full ? { address: v.full } : {}), ...(v.postal ? { postal: v.postal } : {}) }));

  const resolve = async () => {
    try {
      const { data } = await api.get("/admin/settings/resolve-maps", { params: { url: link.trim() } });
      setF((p) => ({ ...p, ...data }));
      toast.success("Titik dari Google Maps dipasang");
    } catch (e) { toast.error(e.response?.data?.detail || "Link tidak valid"); }
  };

  const save = async () => {
    if (!f.contact_name || !f.phone || !f.address || f.lat == null) { toast.error("Lengkapi semua data & titik toko"); return; }
    setSaving(true);
    try {
      const { data } = await api.put("/admin/settings/store", { ...f, lat: Number(f.lat), lng: Number(f.lng) });
      setF((p) => ({ ...p, owner_phones: data.owner_phones }));
      qc.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Pengaturan toko disimpan");
    }
    catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border p-4 max-w-2xl space-y-3" data-testid="store-settings">
      <h3 className="font-bold text-sm flex items-center gap-2"><Store className="w-4 h-4 text-primary" /> Titik Jemput Driver (Toko)</h3>
      <Input data-testid="store-name-input" placeholder="Nama toko (tampil di label pesanan)" value={f.store_name} onChange={(e) => setF({ ...f, store_name: e.target.value })} />
      <div className="grid sm:grid-cols-2 gap-2">
        <Input data-testid="store-contact-input" placeholder="Nama kontak" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
        <Input data-testid="store-phone-input" placeholder="No. HP toko" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <Textarea data-testid="store-address-input" rows={2} placeholder="Alamat lengkap toko" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <Input data-testid="store-postal-input" placeholder="Kode pos" maxLength={5} value={f.postal} onChange={(e) => setF({ ...f, postal: e.target.value })} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="store-gmaps-input" className="pl-9" placeholder="Tempel link Google Maps toko (opsional)" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        <Button variant="outline" data-testid="store-gmaps-btn" onClick={resolve} disabled={!link.trim()}>Pakai Link</Button>
      </div>
      <AddressMap lat={f.lat} lng={f.lng} onChange={onMap} />
      <div className="grid grid-cols-2 gap-2">
        <Input data-testid="store-lat-input" placeholder="Latitude" value={f.lat ?? ""} onChange={(e) => setF({ ...f, lat: e.target.value === "" ? null : e.target.value })} />
        <Input data-testid="store-lng-input" placeholder="Longitude" value={f.lng ?? ""} onChange={(e) => setF({ ...f, lng: e.target.value === "" ? null : e.target.value })} />
      </div>
      <OwnerPhones phones={f.owner_phones || []} onChange={(owner_phones) => setF({ ...f, owner_phones })} />
      <TwilioBotGuide />
      <BiteshipWebhookGuide />
      <Button data-testid="store-save-btn" onClick={save} disabled={saving} className="w-full h-11 rounded-xl">{saving ? "Menyimpan..." : "Simpan Pengaturan Toko"}</Button>
    </div>
  );
};
