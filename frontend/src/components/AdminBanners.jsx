import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const EMPTY = { title: "", subtitle: "", cta_label: "Belanja Sekarang", link: "#all-products", image_url: "", theme: "dark", active: true, order: 0 };

export const AdminBanners = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { data: banners = [] } = useQuery({ queryKey: ["admin-banners"], queryFn: async () => (await api.get("/admin/banners")).data });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["banners"] }); };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd);
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Gambar diunggah");
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const save = async () => {
    if (!form.image_url) { toast.error("Unggah gambar banner dulu"); return; }
    if (editId) await api.put(`/admin/banners/${editId}`, form);
    else await api.post("/admin/banners", form);
    setForm(EMPTY); setEditId(null); refresh();
    toast.success("Banner disimpan");
  };

  const toggle = async (b) => { await api.put(`/admin/banners/${b.banner_id}`, { ...b, active: !b.active }); refresh(); };
  const remove = async (id) => { await api.delete(`/admin/banners/${id}`); refresh(); toast.success("Banner dihapus"); };
  const edit = (b) => { setEditId(b.banner_id); setForm({ ...EMPTY, ...b }); };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border p-4 h-fit space-y-2">
        <h3 className="font-bold text-sm mb-1 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {editId ? "Edit Banner" : "Tambah Banner"}</h3>
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl aspect-[16/6] cursor-pointer overflow-hidden bg-slate-50 hover:border-primary" data-testid="banner-upload-label">
          {form.image_url ? <img src={fileUrl(form.image_url)} alt="" className="w-full h-full object-cover" /> : (
            <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{uploading ? "Mengunggah..." : "Unggah gambar (maks 5MB)"}</span></>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={upload} data-testid="banner-upload-input" />
        </label>
        <Input data-testid="banner-title-input" placeholder="Judul" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9" />
        <Input data-testid="banner-subtitle-input" placeholder="Subjudul" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="h-9" />
        <Input data-testid="banner-cta-input" placeholder="Teks tombol" value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className="h-9" />
        <Input data-testid="banner-link-input" placeholder="Link (#flash-sale / https://...)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="h-9" />
        <div className="flex gap-2">
          <Select value={form.theme} onValueChange={(v) => setForm({ ...form, theme: v })}>
            <SelectTrigger className="h-9" data-testid="banner-theme-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="dark">Teks putih</SelectItem><SelectItem value="light">Teks gelap</SelectItem></SelectContent>
          </Select>
          <Input data-testid="banner-order-input" type="number" placeholder="Urutan" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="h-9 w-24" />
        </div>
        <div className="flex gap-2">
          <Button data-testid="banner-save-btn" onClick={save} disabled={uploading} className="flex-1 h-9 rounded-xl">Simpan Banner</Button>
          {editId && <Button variant="outline" className="h-9 rounded-xl" data-testid="banner-cancel-btn" onClick={() => { setEditId(null); setForm(EMPTY); }}>Batal</Button>}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-2">
        {banners.map((b) => (
          <div key={b.banner_id} data-testid={`admin-banner-${b.banner_id}`} className="bg-white rounded-2xl border p-3 flex items-center gap-3">
            <img src={fileUrl(b.image_url)} alt="" className="w-28 h-14 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm line-clamp-1">{b.title || "(tanpa judul)"}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">#{b.order} · {b.subtitle}</p>
            </div>
            <Button size="sm" variant={b.active ? "default" : "outline"} className="h-8 text-xs" data-testid={`banner-toggle-${b.banner_id}`} onClick={() => toggle(b)}>{b.active ? "Aktif" : "Nonaktif"}</Button>
            <button data-testid={`banner-edit-${b.banner_id}`} onClick={() => edit(b)} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></button>
            <button data-testid={`banner-delete-${b.banner_id}`} onClick={() => remove(b.banner_id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
