import { api } from "@/lib/api";

const KEY = "rsp_ref";
const TTL = 30 * 24 * 3600 * 1000;

export const PO_RE = /PO\s*H\s*\+\s*1/i;
export const isPO = (name) => PO_RE.test(name || "");

export const captureRef = () => {
  const p = new URLSearchParams(window.location.search);
  const code = (p.get("ref") || "").trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,20}$/.test(code)) return;
  localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  api.post("/affiliate/click", { ref_code: code }).catch(() => {});
};

export const getRef = () => {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    return r && Date.now() - r.at < TTL ? r.code : "";
  } catch { return ""; }
};

export const shareLink = (code, productId) => `${window.location.origin}/?ref=${code}${productId ? `&p=${productId}` : ""}`;
