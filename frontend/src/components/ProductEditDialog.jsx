import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api, fileUrl } from "@/lib/api";
import { VariantEditor } from "@/components/AdminExtras";

export const ProductEditDialog = ({ product, onClose, onSaved }) => {
  const [f, setF] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });

  const isNew = product && !product.product_id;

  useEffect(() => {
    if (product) setF({ name: product.name || "", category: product.category || "", image: product.image || "", description: product.description || "", price: product.price ?? "", stock: product.stock ?? 0, hpp: product.hpp || 0, store_price: product.store_price || "", unit: product.unit || "pcs", weight: product.weight || 500, variants: product.variants || [] });
  }, [product]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload", fd);
      setF((p) => ({ ...p, image: fileUrl(data.url) }));
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const save = async () => {
    if (!f.name.trim()) { toast.error("Nama produk wajib diisi"); return; }
    if (!f.category) { toast.error("Pilih kategori"); return; }
    const vs = f.variants.filter((v) => v.name.trim());
    if (f.price === "" && !vs.length) { toast.error("Isi harga jual"); return; }
    if (vs.some((v) => v.price === "" || Number(v.price) < 0)) { toast.error("Isi harga tiap varian"); return; }
    setSaving(true);
    try {
      const body = { ...f, price: Number(f.price) || 0, stock: Number(f.stock) || 0, hpp: Number(f.hpp) || 0, store_price: Number(f.store_price) || 0, weight: Number(f.weight) || 500,
        variants: vs.map((v) => ({ ...v, price: Number(v.price), hpp: Number(v.hpp) || 0, store_price: Number(v.store_price) || 0, stock: Number(v.stock) || 0, weight: Number(v.weight) || 0 })) };
      if (isNew) await api.post("/admin/products", body);
      else await api.patch(`/admin/products/${product.product_id}`, body);
      toast.success(isNew ? "Produk ditambahkan" : "Produk diperbarui");
      onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto" data-testid="product-edit-modal" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{isNew ? "Tambah Produk" : "Edit Produk"}</DialogTitle></DialogHeader>
        {f && (
          <div className="space-y-3">
            <label className="relative block w-32 h-32 rounded-xl overflow-hidden border cursor-pointer group bg-slate-50" data-testid="product-image-upload-label">
              {f.image ? <img src={f.image} alt="" className="w-full h-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Foto produk</span>}
              <span className="absolute inset-0 bg-black/50 text-white text-xs flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-4 h-4" /> {uploading ? "Mengunggah..." : "Ganti foto"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={upload} data-testid="product-image-input" />
            </label>
            <div>
              <p className="text-xs font-medium mb-1">Nama produk</p>
              <Input data-testid="product-name-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Satuan</p>
              <Input data-testid="product-unit-input" placeholder="pcs / 250gr / ikat" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Kategori</p>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger data-testid="product-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {cats.filter((c) => !c.virtual).map((c) => <SelectItem key={c.slug} value={c.slug} data-testid={`product-category-option-${c.slug}`}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs font-medium mb-1">Harga jual (Rp)</p>
                <Input data-testid="product-price-input" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">HPP / modal (Rp)</p>
                <Input data-testid="product-hpp-input" type="number" min={0} value={f.hpp} onChange={(e) => setF({ ...f, hpp: e.target.value })} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Harga toko (Rp)</p>
                <Input data-testid="product-store-price-input" type="number" min={0} placeholder="Ikut harga web" value={f.store_price} onChange={(e) => setF({ ...f, store_price: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Untuk Kasir Toko. Kosong = ikut harga web.</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Stok</p>
                <Input data-testid="product-stock-input" type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
                <label className="text-xs text-muted-foreground mt-2 block">Berat (gram) untuk ongkir</label>
                <Input data-testid="product-weight-input" type="number" min={1} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Deskripsi</p>
              <Textarea data-testid="product-description-input" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <VariantEditor variants={f.variants} onChange={(variants) => setF({ ...f, variants })} />
            <Button data-testid="product-save-btn" onClick={save} disabled={saving || uploading} className="w-full h-11 rounded-xl">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
