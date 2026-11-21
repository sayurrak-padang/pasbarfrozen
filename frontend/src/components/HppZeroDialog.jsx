import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const EMPTY = [];

export const HppZeroDialog = ({ open, onOpenChange, onDone }) => {
  const { data, refetch, isFetching } = useQuery({ queryKey: ["hpp-zero"], enabled: open, queryFn: async () => (await api.get("/admin/products/hpp-zero")).data });
  const items = data || EMPTY;
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (open) refetch(); }, [open]);
  useEffect(() => { setSel(items.map((p) => p.product_id)); }, [items]);
  const archive = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/products/archive-hpp-zero", { product_ids: sel });
      toast.success(`${data.archived} produk diarsipkan (bisa dipulihkan di tab Arsip)`);
      setConfirm(false); onDone(); onOpenChange(false);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal mengarsipkan"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="hpp-zero-dialog">
        <DialogTitle>Produk dengan HPP masih 0</DialogTitle>
        <DialogDescription>Periksa daftar, hapus centang produk yang ingin tetap dijual, lalu konfirmasi. Produk yang diarsipkan disembunyikan dari toko.</DialogDescription>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox checked={items.length > 0 && sel.length === items.length} onCheckedChange={(v) => setSel(v ? items.map((p) => p.product_id) : [])} data-testid="hpp-zero-select-all" />
          <span data-testid="hpp-zero-count">{isFetching ? "Memuat..." : `${sel.length} dari ${items.length} produk dipilih`}</span>
        </div>
        <div className="flex-1 overflow-y-auto border rounded-xl divide-y" data-testid="hpp-zero-list">
          {items.map((p) => (
            <label key={p.product_id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50" data-testid={`hpp-zero-row-${p.product_id}`}>
              <Checkbox checked={sel.includes(p.product_id)} onCheckedChange={(v) => setSel((s) => (v ? [...s, p.product_id] : s.filter((x) => x !== p.product_id)))} />
              <img src={p.image} alt="" className="w-9 h-9 rounded object-cover" />
              <span className="flex-1 line-clamp-1">{p.name}{p.variant_count ? <span className="text-[11px] text-muted-foreground"> · {p.variant_count} varian</span> : null}</span>
              <span className="text-xs text-muted-foreground">{rupiah(p.price)} · stok {p.stock}</span>
            </label>
          ))}
          {!isFetching && items.length === 0 && <p className="text-center text-sm text-muted-foreground py-8" data-testid="hpp-zero-empty">Semua produk aktif sudah punya HPP.</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setConfirm(false); onOpenChange(false); }} data-testid="hpp-zero-cancel">Batal</Button>
          <Button variant="destructive" disabled={busy || sel.length === 0} onClick={() => (confirm ? archive() : setConfirm(true))} className="gap-1" data-testid="hpp-zero-confirm"><Archive className="w-4 h-4" /> {confirm ? `Ya, arsipkan ${sel.length} produk` : `Arsipkan ${sel.length} produk`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
