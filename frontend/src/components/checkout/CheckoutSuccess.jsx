import { Check, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/api";

const PaymentBox = ({ order, onPay }) => {
  const paid = order.status !== "Menunggu Pembayaran";
  return (
    <div className="mt-4 bg-secondary rounded-xl p-4" data-testid="success-payment-box">
      {paid ? (
        <p className="text-sm font-semibold text-primary" data-testid="payment-status-text">Pembayaran: {order.status === "Dibatalkan" ? "Dibatalkan / kedaluwarsa" : "Lunas ✓"}</p>
      ) : (
        <>
          <p className="text-sm font-medium" data-testid="payment-status-text">Menunggu pembayaran {rupiah(order.total)}</p>
          <Button data-testid="pay-now-btn" className="w-full mt-3 rounded-xl" onClick={() => onPay(order)}>
            Bayar Sekarang ({order.payment_method === "qris" ? "QRIS" : "Virtual Account"})
          </Button>
        </>
      )}
    </div>
  );
};

export const CheckoutSuccess = ({ order, onPay, onViewOrders }) => (
  <div className="text-center py-4">
    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
      <Check className="w-8 h-8 text-primary" />
    </div>
    <h3 className="text-xl font-bold">Pesanan Berhasil!</h3>
    <p className="text-sm text-muted-foreground mt-1">No. Pesanan: <b data-testid="success-order-id">{order.order_id}</b></p>
    {order.delivery_slot && (
      <p className="text-xs mt-2 inline-flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-3 py-1" data-testid="success-schedule">
        <CalendarClock className="w-3.5 h-3.5" /> Dikirim {order.delivery_date} · {order.delivery_slot}
      </p>
    )}
    {order.payment_method === "cod" ? (
      <p className="mt-4 text-sm bg-emerald-50 text-emerald-700 rounded-xl p-3">Siapkan uang tunai {rupiah(order.total)} saat kurir tiba.</p>
    ) : (
      <PaymentBox order={order} onPay={onPay} />
    )}
    <Button className="w-full mt-5 rounded-xl" data-testid="view-orders-btn" onClick={onViewOrders}>Lihat Pesanan Saya</Button>
  </div>
);
