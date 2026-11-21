import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Download, Upload, Archive, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { downloadBlob } from "@/components/AdminReports";

export const ConfirmDelete = ({ trigger, title, onConfirm }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>Produk dihapus permanen dari katalog. Riwayat pesanan & laporan laba rugi tetap aman. Pilih "Arsipkan" jika ingin bisa dipulihkan.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="delete-cancel">Batal</AlertDialogCancel>
        <AlertDialogAction data-testid="delete-confirm" className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>Hapus Permanen</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export const ProductToolbar = ({ onAdd, onDone }) => {
  const [busy, setBusy] = useState(false);
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/products/import", fd);
      toast.success(`Upload selesai: ${data.created} produk baru, ${data.updated} diperbarui`);
      if (data.errors.length) toast.error(`${data.errors.length} baris gagal: ${data.errors.slice(0, 3).join("; ")}`, { duration: 10000 });
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" className="gap-1" onClick={onAdd} data-testid="add-product-btn"><Plus className="w-4 h-4" /> Tambah Produk</Button>
      <Button size="sm" variant="outline" className="gap-1" data-testid="export-products-btn" onClick={() => downloadBlob("/admin/products/export.xlsx", {}, "produk-rak-sayur.xlsx")}><Download className="w-4 h-4" /> Export / Template Excel</Button>
      <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-slate-50" data-testid="import-products-label">
        <Upload className="w-4 h-4" /> {busy ? "Mengunggah..." : "Upload Massal Excel"}
        <input type="file" accept=".xlsx,.csv" className="hidden" onChange={importFile} disabled={busy} data-testid="import-products-input" />
      </label>
    </div>
  );
};

export const BulkBar = ({ ids, archivedView, onClear, onDone }) => {
  const [f, setF] = useState({ category: "", stock: "", discount: "", active: "" });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  if (!ids.length) return null;

  const run = async (body, msg) => {
    try { await api.post("/admin/products/bulk", { product_ids: ids, ...body }); toast.success(msg); onDone(); onClear(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  const apply = () => {
    const body = {};
    if (f.category) body.category = f.category;
    if (f.stock !== "") body.stock = Number(f.stock);
    if (f.discount !== "") body.discount = Number(f.discount);
    if (f.active) body.active = f.active === "true";
    if (!Object.keys(body).length) { toast.error("Isi minimal satu perubahan"); return; }
    run(body, `${ids.length} produk diperbarui`);
  };
  const del = async () => {
    await api.post("/admin/products/bulk-delete", { product_ids: ids });
    toast.success(`${ids.length} produk dihapus`); onDone(); onClear();
  };

  return (
    <div className="sticky top-16 z-10 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="bulk-bar">
      <span className="text-sm font-semibold" data-testid="bulk-count">{ids.length} dipilih</span>
      <button onClick={onClear} className="text-muted-foreground" data-testid="bulk-clear"><X className="w-4 h-4" /></button>
      <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
        <SelectTrigger className="w-44 h-9 bg-white" data-testid="bulk-category"><SelectValue placeholder="Ubah kategori" /></SelectTrigger>
        <SelectContent>{cats.filter((c) => !c.virtual).map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Input type="number" placeholder="Stok" className="w-20 h-9 bg-white" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} data-testid="bulk-stock" />
      <Input type="number" placeholder="Diskon %" className="w-24 h-9 bg-white" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} data-testid="bulk-discount" />
      <Select value={f.active} onValueChange={(v) => setF({ ...f, active: v })}>
        <SelectTrigger className="w-32 h-9 bg-white" data-testid="bulk-active"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="true">Aktif</SelectItem><SelectItem value="false">Nonaktif</SelectItem></SelectContent>
      </Select>
      <Button size="sm" onClick={apply} data-testid="bulk-apply">Terapkan</Button>
      <Button size="sm" variant="outline" className="gap-1" data-testid="bulk-archive"
        onClick={() => run({ archived: !archivedView }, archivedView ? "Produk dipulihkan" : "Produk diarsipkan")}>
        <Archive className="w-4 h-4" /> {archivedView ? "Pulihkan" : "Arsipkan"}
      </Button>
      <ConfirmDelete title={`Hapus ${ids.length} produk?`} onConfirm={del}
        trigger={<Button size="sm" variant="outline" className="gap-1 text-red-600" data-testid="bulk-delete"><Trash2 className="w-4 h-4" /> Hapus</Button>} />
    </div>
  );
};
