// Cetak struk kasir ke printer thermal (58 mm / 80 mm) lewat dialog cetak browser.
// Printer kasir USB/Bluetooth yang sudah terpasang di komputer/HP muncul di daftar printer.
// Iframe tersembunyi dipakai supaya tetap bisa mencetak setelah transaksi tersimpan (tidak diblokir popup).
import { BRAND } from "@/config/brand";

export const PAY_LABEL = { cash: "Tunai", qris: "QRIS", transfer: "Transfer", debit: "Kartu Debit/Kredit" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Math.round(n || 0).toLocaleString("id-ID");

export const receiptHtml = (sale, store = {}, paper = "58") => {
  const w = paper === "80" ? 72 : 48; // lebar area cetak (mm)
  const d = new Date(sale.created_at);
  const when = d.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rows = sale.items.map((i) => `
    <div class="it">${esc(i.name)}${i.variant_name ? ` (${esc(i.variant_name)})` : ""}</div>
    <div class="row"><span>${i.quantity} x ${num(i.price)}</span><span>${num(i.line_total ?? i.price * i.quantity)}</span></div>`).join("");
  const line = (l, v, cls = "") => `<div class="row ${cls}"><span>${l}</span><span>${v}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.sale_id)}</title><style>
    @page { size: ${paper}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { width: ${w}mm; margin: 0 auto; padding: 3mm 0 6mm; font: 11px/1.35 "Courier New", ui-monospace, monospace; }
    .c { text-align: center; } .b { font-weight: 700; } .big { font-size: 14px; }
    .row { display: flex; justify-content: space-between; gap: 4px; } .row span:last-child { text-align: right; white-space: nowrap; }
    .it { margin-top: 2px; word-break: break-word; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    .void { border: 2px solid #000; padding: 2px; margin: 4px 0; }
  </style></head><body>
    <div class="c b big">${esc(store.store_name || BRAND.name)}</div>
    ${store.address ? `<div class="c">${esc(store.address)}</div>` : ""}
    ${store.phone ? `<div class="c">Telp/WA ${esc(store.phone)}</div>` : ""}
    <hr>
    ${line("No", esc(sale.sale_id))}
    ${line("Tanggal", when)}
    ${line("Kasir", esc(sale.cashier))}
    ${sale.customer_name ? line("Pelanggan", esc(sale.customer_name)) : ""}
    ${sale.status === "void" ? `<div class="c b void">DIBATALKAN</div>` : ""}
    <hr>${rows}<hr>
    ${line("Subtotal", num(sale.subtotal))}
    ${sale.discount ? line("Diskon", "-" + num(sale.discount)) : ""}
    ${line("TOTAL", num(sale.total), "b big")}
    ${line(PAY_LABEL[sale.payment_method] || sale.payment_method, num(sale.cash_received))}
    ${sale.payment_method === "cash" ? line("Kembali", num(sale.change)) : ""}
    ${sale.note ? `<hr><div>${esc(sale.note)}</div>` : ""}
    <hr>
    <div class="c">Terima kasih sudah berbelanja</div>
    <div class="c">Belanja online: ${esc(BRAND.domain)}</div>
  </body></html>`;
};

export const printReceipt = (sale, store, paper) => {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open();
  doc.write(receiptHtml(sale, store, paper));
  doc.close();
  const go = () => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 1500); }
  };
  setTimeout(go, 150);
};
