// Promo ongkir yang ditampilkan di keranjang. Harus sama dengan voucher ONGKIR10 di backend
// (server.py: min_purchase 150000, potongan ongkir 10000).
export const SHIP_PROMO = { code: "ONGKIR10", threshold: 150000, value: 10000 };

export const shipPromoProgress = (subtotal) => {
  const left = Math.max(0, SHIP_PROMO.threshold - subtotal);
  return { left, reached: left === 0, pct: Math.min(100, (subtotal / SHIP_PROMO.threshold) * 100) };
};
