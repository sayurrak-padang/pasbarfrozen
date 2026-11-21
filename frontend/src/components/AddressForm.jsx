import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { AddressMap } from "@/components/AddressMap";
import { RegionFields } from "@/components/RegionFields";

const EMPTY = { label: "Rumah", name: "", phone: "", full: "", postal: "", district: "", city: "", province: "", area_id: "", detail: "", lat: null, lng: null, is_default: false };
const LABELS = ["Rumah", "Kantor", "Kos", "Lainnya"];

export const AddressForm = ({ address, onClose, onSaved }) => {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (address) setF({ ...EMPTY, ...address }); }, [address]);

  const save = async () => {
    if (!f.name || !f.phone || !f.full) { toast.error("Lengkapi nama, HP, dan alamat"); return; }
    if (!f.district || !/^\d{5}$/.test(f.postal || "")) { toast.error("Lengkapi kecamatan dan kode pos (5 digit)"); return; }
    setSaving(true);
    try {
      const body = { label: f.label, name: f.name, phone: f.phone, full: f.full, postal: f.postal, district: f.district, city: f.city, province: f.province, area_id: f.area_id, detail: f.detail, lat: f.lat, lng: f.lng, is_default: f.is_default };
      const { data } = address?.address_id ? await api.put(`/addresses/${address.address_id}`, body) : await api.post("/addresses", body);
      toast.success("Alamat disimpan");
      onSaved(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!address} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="address-form-modal" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{address?.address_id ? "Ubah Alamat" : "Tambah Alamat"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <RegionFields testid="address-region" required locate value={f} onChange={(v) => setF((p) => ({ ...p, ...v }))} />
          <div className="space-y-1" data-testid="address-pin-step">
            <p className="text-[11px] font-semibold text-slate-600">2. Geser pin ke titik rumah Anda (untuk kurir instan)</p>
            <AddressMap hideSearch lat={f.lat} lng={f.lng} onChange={(v) => setF((p) => ({ ...p, lat: v.lat, lng: v.lng, ...(v.full ? { full: v.full } : {}), ...(v.postal && !p.postal ? { postal: v.postal } : {}) }))} />
          </div>
          <p className="text-[11px] font-semibold text-slate-600">3. Data penerima</p>
          <div className="flex gap-2">
            {LABELS.map((l) => (
              <button key={l} type="button" data-testid={`address-label-${l}`} onClick={() => setF({ ...f, label: l })}
                className={`text-xs px-3 py-1 rounded-full border ${f.label === l ? "bg-primary text-white border-primary" : "bg-white"}`}>{l}</button>
            ))}
          </div>
          <Input data-testid="address-name-input" placeholder="Nama penerima" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input data-testid="address-phone-input" placeholder="No. HP" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Textarea data-testid="address-full-input" rows={2} placeholder="Alamat lengkap (otomatis dari peta, bisa diubah)" value={f.full} onChange={(e) => setF({ ...f, full: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox data-testid="address-default-checkbox" checked={f.is_default} onCheckedChange={(v) => setF({ ...f, is_default: !!v })} /> Jadikan alamat utama
          </label>
          <Button data-testid="address-save-btn" onClick={save} disabled={saving} className="w-full h-11 rounded-xl">{saving ? "Menyimpan..." : "Simpan Alamat"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
