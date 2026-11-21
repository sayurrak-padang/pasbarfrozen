import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getRef, isPO } from "@/lib/ref";
import { QrisPayDialog } from "@/components/QrisPayDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { paySnap, PAY_FAIL } from "@/lib/midtrans";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useCheckoutData } from "@/components/checkout/useCheckoutData";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";
import { AddressSection } from "@/components/checkout/AddressSection";
import { CourierSection } from "@/components/checkout/CourierSection";
import { PaymentSection } from "@/components/checkout/PaymentSection";
import { VoucherSection, OrderSummary } from "@/components/checkout/VoucherSection";
import { BRAND, isServiceCity } from "@/config/brand";

const validateCheckout = ({ addr, courier, schedule, payment }) => {
  if (!addr.name || !addr.phone || !addr.full) return "Lengkapi alamat pengiriman";
  if (!courier) return payment === "cod" ? `COD hanya tersedia dengan Kurir Toko untuk alamat ${BRAND.city.name}` : "Pilih jasa kirim";
  if (courier.type !== "instan" && (!addr.district || !/^\d{5}$/.test(addr.postal || ""))) return "Lengkapi kecamatan & kode pos untuk JNE/J&T";
  if (courier.type === "instan" && !schedule?.slot) return "Pilih jadwal pengiriman";
  if (courier.type === "instan" && addr.lat == null) return "Tandai lokasi pengiriman di peta";
  return null;
};

const toOrderItems = (items) => items.map((i) => ({
  product_id: i.product_id, name: i.name, image: i.image, price: i.price, quantity: i.quantity,
  unit: i.unit || "pcs", variant_id: i.variant_id || null, variant_name: i.variant_name || null, recipe_id: i.recipe_id || null,
}));

export const CheckoutModal = ({ open, onOpenChange }) => {
  const { items, subtotal, hasFresh, hasCold, clearCart, refreshPromo } = useCart();
  useEffect(() => { if (open) refreshPromo(); }, [open, refreshPromo]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qrisOrder, setQrisOrder] = useState(null);
  const qc = useQueryClient();
  const weightGrams = items.reduce((s, i) => s + i.quantity * (i.weight || 500), 0) || 500;
  const d = useCheckoutData({ open, user, hasFresh, hasCold, subtotal, weightGrams });
  const [payment, setPayment] = useState("cod");
  const [note] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState(null);
  const [voucherErr, setVoucherErr] = useState("");
  const [schedule, setSchedule] = useState(null);

  const freeShip = !!voucher?.free_shipping;
  const shipDiscount = freeShip ? 0 : Math.min(voucher?.ship_discount || 0, d.courier?.cost || 0);
  const finalShip = freeShip ? 0 : Math.max(0, (d.courier?.cost || 0) - shipDiscount);
  const voucherDiscount = voucher && !voucher.free_shipping ? Math.min(voucher.discount, subtotal) : 0;
  const total = Math.max(0, subtotal + finalShip - voucherDiscount);
  const instant = d.courier?.type === "instan";
  const inCity = !d.addr.city || isServiceCity(d.addr.city);
  const shown = d.couriers.filter((c) => (c.code === "toko" ? inCity : payment !== "cod"));
  const shownKey = shown.map((c) => c.code).join(",");
  useEffect(() => {
    if (!shown.some((c) => c.code === d.courier?.code)) d.setCourier(shown[0] || null);
  }, [shownKey, d.courier?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyVoucher = async (raw) => {
    setVoucherErr("");
    const code = (raw || "").trim();
    if (!code) return;
    setVoucherInput(code);
    try {
      const { data } = await api.post("/vouchers/validate", { code, subtotal });
      setVoucher(data);
      toast.success(`Voucher ${data.code} diterapkan`);
    } catch (e) {
      setVoucher(null);
      setVoucherErr(e.response?.data?.detail || "Voucher tidak valid");
    }
  };
  const removeVoucher = () => { setVoucher(null); setVoucherInput(""); setVoucherErr(""); };

  const openPayment = (order) => paySnap(order.snap_token, {
    onDone: async () => { const { data } = await api.get(`/orders/${order.order_id}/payment-status`); setSuccess(data); },
    onError: () => toast.error(`${PAY_FAIL} Pesanan Anda tetap tersimpan, tekan Bayar Sekarang.`),
  }).catch((e) => toast.error(`${e.message} Pesanan Anda tetap tersimpan, tekan Bayar Sekarang.`, { duration: 8000 }));

  const placeOrder = async () => {
    if (!user) { toast.error("Silakan login dulu"); navigate("/login"); return; }
    const err = validateCheckout({ addr: d.addr, courier: d.courier, schedule, payment });
    if (err) { toast.error(err); return; }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        items: toOrderItems(items), subtotal, shipping_cost: finalShip, discount: voucherDiscount, total,
        courier: d.courier.name, courier_type: d.courier.type, payment_method: payment,
        address: d.addr, voucher_code: voucher?.code || "", note, ref_code: getRef(),
        delivery_date: instant ? schedule.date : "", delivery_slot: instant ? schedule.slot : "",
      });
      setSuccess(data);
      clearCart();
      qc.invalidateQueries({ queryKey: ["flash-sale"] });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal membuat pesanan");
    } finally {
      setPlacing(false);
    }
  };

  const closeSuccess = (goOrders) => { setSuccess(null); onOpenChange(false); if (goOrders) navigate("/orders"); };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) closeSuccess(false); }}>
        <DialogContent className="max-w-md" data-testid="order-success-modal">
          <DialogTitle className="sr-only">Pesanan berhasil</DialogTitle>
          <DialogDescription className="sr-only">Ringkasan pesanan dan status pembayaran</DialogDescription>
          <CheckoutSuccess order={success} onPay={(o) => (o.qris ? setQrisOrder(o) : openPayment(o))} onUpdate={setSuccess} onViewOrders={() => closeSuccess(true)} />
        </DialogContent>
        <QrisPayDialog order={qrisOrder} onClose={() => setQrisOrder(null)} onPaid={(o) => { setQrisOrder(null); setSuccess(o); }} />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="checkout-modal">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription className="sr-only">Lengkapi alamat, kurir, dan pembayaran</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <AddressSection user={user} saved={d.saved} addrId={d.addrId} addr={d.addr} setAddr={d.setAddr} onPick={d.pickAddress}
            instant={instant} onManage={() => { onOpenChange(false); navigate("/addresses"); }}
            onFixAddress={(id) => { onOpenChange(false); navigate(`/addresses?edit=${id}`); }} />
          <PaymentSection payment={payment} setPayment={setPayment} />
          <CourierSection couriers={shown} courier={d.courier} setCourier={d.setCourier} ratesLoading={d.ratesLoading}
            hasFresh={hasFresh} hasCold={hasCold} schedule={schedule} setSchedule={setSchedule} payment={payment} po={items.some((i) => isPO(i.name))} />
          <VoucherSection voucher={voucher} input={voucherInput} setInput={setVoucherInput} error={voucherErr}
            available={d.availVouchers} onApply={applyVoucher} onRemove={removeVoucher} />
          <OrderSummary subtotal={subtotal} freeShip={freeShip} shipDiscount={shipDiscount} finalShip={finalShip} voucherDiscount={voucherDiscount} total={total} />
          <Button data-testid="place-order-btn" disabled={placing} onClick={placeOrder} className="w-full h-12 rounded-xl text-base font-semibold">
            {placing ? "Memproses..." : `Buat Pesanan · ${rupiah(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
