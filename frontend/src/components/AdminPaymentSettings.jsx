import { useEffect, useRef, useState } from "react";
import { QrCode, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY = { qris_image: "", qris_name: "", banks: [], note: "" };

// Pengaturan QRIS toko dan rekening transfer yang ditampilkan ke pembeli saat checkout.
export const AdminPaymentSettings = () => {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  useEffect(() => { api.get("/payment-info").then(({ data }) => setF({ ...EMPTY, ...data })); }, []);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd);
      setF((p) => ({ ...p, qris_image: data.url }));
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
  };
  const setBank = (i, k, v) => setF((p) => ({ ...p, banks: p.banks.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));
  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings/payment", { ...f, banks: f.banks.filter((b) => b.bank && b.number && b.holder) });
      qc.invalidateQueries({ queryKey: ["payment-info"] });
      toast.success("Pengaturan pembayaran disimpan");
    } catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border p-4 max-w-2xl space-y-3" data-testid="payment-settings">
      <h3 className="font-bold text-sm flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /> Pembayaran: QRIS Toko & Rekening</h3>
      <div className="flex items-start gap-3">
        {f.qris_image ? <img src={fileUrl(f.qris_image)} alt="QRIS" className="w-32 h-32 object-contain border rounded-xl" /> : <div className="w-32 h-32 border-2 border-dashed rounded-xl flex items-center justify-center text-xs text-muted-foreground text-center p-2">Belum ada QRIS</div>}
        <div className="flex-1 space-y-2">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
          <Button variant="outline" size="sm" onClick={() => ref.current?.click()} data-testid="qris-upload-btn">Unggah Gambar QRIS</Button>
          <Input placeholder="Nama merchant QRIS (opsional)" value={f.qris_name} onChange={(e) => setF({ ...f, qris_name: e.target.value })} />
        </div>
      </div>
      <p className="text-xs font-semibold">Rekening transfer</p>
      {f.banks.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.2fr_1.4fr_auto] gap-2">
          <Input placeholder="Bank (BRI, BSI...)" value={b.bank} onChange={(e) => setBank(i, "bank", e.target.value)} />
          <Input placeholder="No. rekening" value={b.number} onChange={(e) => setBank(i, "number", e.target.value)} />
          <Input placeholder="Atas nama" value={b.holder} onChange={(e) => setBank(i, "holder", e.target.value)} />
          <button type="button" onClick={() => setF((p) => ({ ...p, banks: p.banks.filter((_, j) => j !== i) }))} className="p-2 text-red-600" aria-label="Hapus rekening"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {f.banks.length < 5 && <Button variant="outline" size="sm" className="gap-1" onClick={() => setF((p) => ({ ...p, banks: [...p.banks, { bank: "", number: "", holder: "" }] }))}><Plus className="w-4 h-4" /> Tambah Rekening</Button>}
      <Textarea rows={2} placeholder="Catatan untuk pembeli (opsional), mis. 'Kirim bukti paling lambat 1 jam'" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button onClick={save} disabled={saving} className="w-full h-11 rounded-xl" data-testid="payment-save-btn">{saving ? "Menyimpan..." : "Simpan Pengaturan Pembayaran"}</Button>
    </div>
  );
};
