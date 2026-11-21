import { LOGO_URL, rupiah } from "@/lib/api";
import { BRAND } from "@/config/brand";

const CSS = `
  @page { size: 100mm 100mm; margin: 3mm; }
  * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { margin: 0; width: 94mm; font-size: 9pt; color: #000; }
  .hd { display: flex; align-items: center; gap: 2mm; border-bottom: 1.5px solid #000; padding-bottom: 1.5mm; }
  .hd img { width: 9mm; height: 9mm; } .hd b { font-size: 11pt; } .oid { margin-left: auto; text-align: right; font-size: 8pt; }
  .box { border: 1px solid #000; padding: 1.5mm; margin-top: 1.5mm; }
  .lbl { font-size: 7pt; text-transform: uppercase; } .nm { font-size: 11pt; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 1mm; font-size: 8pt; } td { border-bottom: 1px dashed #000; padding: .6mm 0; } .q { text-align: right; width: 10mm; font-weight: bold; }
  .ft { display: flex; justify-content: space-between; margin-top: 1.5mm; font-weight: bold; }
  .sm { font-size: 8pt; }
  .pg { page-break-after: always; break-after: page; } .pg:last-child { page-break-after: auto; break-after: auto; }
`;

// Builds label with DOM APIs + textContent only (no HTML string injection).
const builder = (doc) => (tag, { cls, text, attrs } = {}, children = []) => {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
  children.filter(Boolean).forEach((c) => n.appendChild(c));
  return n;
};

const buildLabel = (h, o, s = {}) => {
  const a = o.address || {};
  const rows = o.items.map((i) => h("tr", {}, [
    h("td", {}, [doc_text(h, i.name), i.variant_name ? h("b", { text: ` (${i.variant_name})` }) : null]),
    h("td", { cls: "q", text: i.quantity }),
  ]));
  const pay = o.payment_method === "cod" ? `COD: ${rupiah(o.total)}` : `LUNAS (${String(o.payment_method || "").toUpperCase()})`;
  const resi = o.shipment?.waybill_id;
  const ship = h("div", { cls: "sm" }, [doc_text(h, `Subtotal ${rupiah(o.subtotal)} · Ongkir${o.payment_method === "cod" ? " COD" : ""} ${rupiah(o.shipping_cost || 0)}${o.discount ? ` · Diskon -${rupiah(o.discount)}` : ""}`)]);
  return h("div", { cls: "pg" }, [
    h("div", { cls: "hd" }, [
      h("img", { attrs: { src: LOGO_URL, alt: "" } }),
      h("b", { text: s.store_name || BRAND.name }),
      h("div", { cls: "oid" }, [h("b", { text: o.order_id }), h("br"), doc_text(h, new Date(o.created_at).toLocaleString("id-ID"))]),
    ]),
    h("div", { cls: "box" }, [
      h("div", { cls: "lbl", text: "Pengirim" }),
      h("div", { cls: "sm", text: `${s.store_name || BRAND.name} · ${s.phone || "-"}` }),
      h("div", { cls: "sm", text: s.address || "-" }),
    ]),
    h("div", { cls: "box" }, [
      h("div", { cls: "lbl", text: "Penerima" }),
      h("div", { cls: "nm", text: `${a.name || ""} · ${a.phone || ""}` }),
      h("div", { text: `${a.full || ""}${a.postal ? `, ${a.postal}` : ""}` }),
      o.note ? h("div", {}, [h("i", { text: `Catatan: ${o.note}` })]) : null,
    ]),
    h("div", { cls: "box" }, [
      h("b", { text: o.courier }),
      resi ? doc_text(h, ` · Resi ${resi}`) : null,
      o.delivery_slot ? doc_text(h, ` · Jadwal ${o.delivery_date} ${o.delivery_slot}`) : null,
      h("table", {}, [h("tbody", {}, rows)]),
    ]),
    ship,
    h("div", { cls: "ft" }, [h("span", { text: pay }), h("span", { text: `Total ${rupiah(o.total)}` })]),
  ]);
};

const doc_text = (h, t) => h("span", { text: t });

export const printLabels = (orders, store) => {
  const w = window.open("", "_blank", "width=420,height=480");
  if (!w) return;
  const doc = w.document;
  const h = builder(doc);
  doc.title = orders.length === 1 ? orders[0].order_id : `Label ${orders.length} pesanan`;
  doc.head.appendChild(h("style", { text: CSS }));
  orders.forEach((o) => doc.body.appendChild(buildLabel(h, o, store)));
  const logo = doc.querySelector("img");
  const go = () => { w.focus(); w.print(); };
  if (logo && !logo.complete) { logo.onload = go; logo.onerror = go; } else go();
};

export const printLabel = (o, store) => printLabels([o], store);

const ROUTE_CSS = `
  @page { size: A4; margin: 10mm; } * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { font-size: 10pt; color: #000; } h1 { font-size: 14pt; margin: 0 0 2mm; } h2 { font-size: 11pt; margin: 5mm 0 1mm; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #000; padding: 1.5mm; vertical-align: top; text-align: left; }
  .r { text-align: right; white-space: nowrap; } .tot { font-weight: bold; margin-top: 3mm; font-size: 12pt; }
`;

export const printRoute = (date, groups, store = {}) => {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const doc = w.document;
  const h = builder(doc);
  doc.title = `Daftar Antar ${date}`;
  doc.head.appendChild(h("style", { text: ROUTE_CSS }));
  doc.body.appendChild(h("h1", { text: `Daftar Antar Kurir Toko · ${store.store_name || BRAND.name} · ${date}` }));
  let grand = 0;
  groups.forEach(({ slot, orders }) => {
    const sub = orders.reduce((s, o) => s + o.total, 0);
    grand += sub;
    doc.body.appendChild(h("h2", { text: `Slot ${slot} · ${orders.length} pesanan · COD ${rupiah(sub)}` }));
    const rows = orders.map((o, i) => {
      const a = o.address || {};
      return h("tr", {}, [
        h("td", { text: i + 1 }),
        h("td", {}, [h("b", { text: `${a.name || o.user_name} · ${a.phone || ""}` }), h("br"), doc_text(h, [a.full, a.detail, a.district].filter(Boolean).join(", ")),
          o.note ? h("div", {}, [h("i", { text: `Catatan: ${o.note}` })]) : null]),
        h("td", { text: o.items.map((x) => `${x.quantity}× ${x.name}${x.variant_name ? ` (${x.variant_name})` : ""}`).join("; ") }),
        h("td", { text: o.order_id }),
        h("td", { cls: "r", text: rupiah(o.total) }),
        h("td", { text: "" }),
      ]);
    });
    doc.body.appendChild(h("table", {}, [
      h("thead", {}, [h("tr", {}, ["#", "Penerima & alamat", "Barang", "Pesanan", "Tagih COD", "Paraf"].map((t) => h("th", { text: t })))]),
      h("tbody", {}, rows),
    ]));
  });
  doc.body.appendChild(h("div", { cls: "tot", text: `Total uang COD yang harus ditagih: ${rupiah(grand)}` }));
  w.focus(); w.print();
};
