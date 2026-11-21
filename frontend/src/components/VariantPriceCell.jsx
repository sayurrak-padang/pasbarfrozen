import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

export const VariantPriceCell = ({ p, onSaved }) => {
  const save = async (vid, key, raw, el) => {
    const val = Number(raw);
    const cur = p.variants.find((v) => v.variant_id === vid);
    const reset = () => { if (el) el.value = cur?.[key] || 0; };
    if (!cur || Number.isNaN(val) || val < 0) { reset(); return; }
    if (val === (cur[key] || 0)) return;
    if (key === "price" && val <= 0) { toast.error("Harga jual harus lebih dari 0"); reset(); return; }
    try {
      await api.patch(`/admin/products/${p.product_id}/variants/${vid}`, { [key]: val });
      toast.success(`${{ price: "Harga jual", hpp: "HPP", store_price: "Harga toko" }[key]} varian ${cur.name} disimpan`);
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal menyimpan"); }
  };
  return (
    <div className="space-y-1 min-w-[350px]" data-testid={`variant-prices-${p.product_id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_88px] gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><span>Varian</span><span>Harga jual</span><span>HPP</span><span>Harga toko</span></div>
      {p.variants.map((v) => (
        <div key={v.variant_id} className="grid grid-cols-[minmax(0,1fr)_88px_88px_88px] gap-1.5 items-center">
          <span className="text-xs truncate" title={v.name}>{v.name}</span>
          <Input type="number" defaultValue={v.price} className="h-7 text-xs px-2" onBlur={(e) => save(v.variant_id, "price", e.target.value, e.target)} data-testid={`vprice-${p.product_id}-${v.variant_id}`} />
          <Input type="number" defaultValue={v.hpp || 0} className={`h-7 text-xs px-2 ${v.hpp ? "" : "border-amber-300 bg-amber-50"}`} onBlur={(e) => save(v.variant_id, "hpp", e.target.value, e.target)} data-testid={`vhpp-${p.product_id}-${v.variant_id}`} />
          <Input type="number" min={0} defaultValue={v.store_price || ""} placeholder="Web" className="h-7 text-xs px-2" title="Kosong = kasir pakai harga web" onBlur={(e) => save(v.variant_id, "store_price", e.target.value || 0, e.target)} data-testid={`vstore-${p.product_id}-${v.variant_id}`} />
        </div>
      ))}
    </div>
  );
};
