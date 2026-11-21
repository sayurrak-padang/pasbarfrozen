import { api, rupiah } from "@/lib/api";
import { BRAND } from "@/config/brand";

const W = 1080, H = 1920;

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

const wrap = (ctx, text, maxW) => {
  const words = text.split(/\s+/), lines = [];
  let cur = "";
  words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
};

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

export const makeStoryCard = async ({ product, code, link, storeName = BRAND.name }) => {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, BRAND.colors.themeColor); g.addColorStop(1, BRAND.colors.button);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(980, 160, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, 1750, 220, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#fff"; ctx.font = "bold 54px Arial"; ctx.fillText(storeName, 80, 150);
  ctx.font = "34px Arial"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText(BRAND.tagline, 80, 205);

  const { data } = await api.get(`/products/${product.product_id}/card-image`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  try {
    const img = await loadImg(url);
    const S = 920, x = 80, y = 280;
    ctx.save(); roundRect(ctx, x, y, S, S, 48); ctx.clip();
    const r = Math.max(S / img.width, S / img.height);
    ctx.drawImage(img, x + (S - img.width * r) / 2, y + (S - img.height * r) / 2, img.width * r, img.height * r);
    ctx.restore();
  } finally { URL.revokeObjectURL(url); }

  ctx.fillStyle = "#fff"; ctx.font = "bold 64px Arial";
  wrap(ctx, product.name, 920).slice(0, 3).forEach((l, i) => ctx.fillText(l, 80, 1300 + i * 76));
  ctx.fillStyle = "#fde047"; ctx.font = "bold 96px Arial"; ctx.fillText(rupiah(product.final_price), 80, 1560);

  ctx.fillStyle = "#fff"; roundRect(ctx, 80, 1620, 920, 200, 40); ctx.fill();
  ctx.fillStyle = BRAND.colors.themeColor; ctx.font = "bold 44px Arial"; ctx.fillText("Pesan sekarang:", 120, 1690);
  ctx.fillStyle = "#0f172a"; ctx.font = "34px Arial";
  wrap(ctx, link.replace(/^https?:\/\//, ""), 840).slice(0, 2).forEach((l, i) => ctx.fillText(l, 120, 1745 + i * 42));
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "30px Arial"; ctx.fillText(`Kode referral: ${code}`, 80, 1880);
  return new Promise((res) => c.toBlob(res, "image/png"));
};

export const shareOrDownload = async (blob, name, text) => {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
};
