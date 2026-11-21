import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/api";

const VoucherApplied = ({ voucher, onRemove }) => (
  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3" data-testid="voucher-applied">
    <div>
      <p className="text-sm font-semibold text-primary">{voucher.code}</p>
      <p className="text-[11px] text-emerald-700">{voucher.description}</p>
    </div>
    <button onClick={onRemove} data-testid="remove-voucher-btn" className="text-xs text-red-600 font-medium">Hapus</button>
  </div>
);

export const VoucherSection = ({ voucher, input, setInput, error, available, onApply, onRemove }) => (
  <section>
    <h4 className="font-semibold text-sm mb-2">Kode Voucher</h4>
    {voucher ? <VoucherApplied voucher={voucher} onRemove={onRemove} /> : (
      <>
        <div className="flex gap-2">
          <Input data-testid="voucher-input" placeholder="Masukkan kode" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} className="h-10" />
          <Button type="button" variant="outline" data-testid="apply-voucher-btn" onClick={() => onApply(input)} className="h-10 rounded-xl shrink-0">Pakai</Button>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-1" data-testid="voucher-error">{error}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {available.map((v) => (
            <button key={v.code} type="button" data-testid={`voucher-chip-${v.code}`} onClick={() => onApply(v.code)}
              className="text-[11px] font-mono bg-secondary hover:bg-emerald-100 text-emerald-700 border border-emerald-200 border-dashed rounded-lg px-2 py-1">
              {v.code}
            </button>
          ))}
        </div>
      </>
    )}
  </section>
);

export const OrderSummary = ({ subtotal, freeShip, shipDiscount = 0, finalShip, voucherDiscount, total }) => (
  <section className="bg-secondary rounded-xl p-4 space-y-1.5 text-sm">
    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{rupiah(subtotal)}</span></div>
    <div className="flex justify-between"><span className="text-muted-foreground">Ongkir</span><span>{freeShip ? <span className="text-primary font-semibold">GRATIS</span> : rupiah(finalShip + shipDiscount)}</span></div>
    {shipDiscount > 0 && (
      <div className="flex justify-between" data-testid="summary-ship-discount"><span className="text-muted-foreground">Diskon ongkir</span><span className="text-primary">-{rupiah(shipDiscount)}</span></div>
    )}
    {voucherDiscount > 0 && (
      <div className="flex justify-between" data-testid="summary-voucher-discount"><span className="text-muted-foreground">Diskon voucher</span><span className="text-red-500">-{rupiah(voucherDiscount)}</span></div>
    )}
    <div className="flex justify-between font-bold text-base pt-1.5 border-t"><span>Total</span><span className="text-primary">{rupiah(total)}</span></div>
  </section>
);
