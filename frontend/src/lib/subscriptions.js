export const SUB_DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
// Hari ini dalam format 0 = Senin ... 6 = Minggu (sama dengan backend).
export const todayIndex = () => (new Date().getDay() + 6) % 7;
export const subItemsFromCart = (items) => items.map((i) => ({
  product_id: i.product_id, variant_id: i.variant_id || null, name: i.name, variant_name: i.variant_name || null,
  image: i.image || "", quantity: i.quantity,
}));
