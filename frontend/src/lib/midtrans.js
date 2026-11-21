import { api } from "@/lib/api";

let loading = null;

export const OPEN_FAIL = "Halaman pembayaran Midtrans gagal dibuka. Periksa koneksi internet lalu coba lagi.";
export const PAY_FAIL = "Pembayaran ditolak atau gagal diproses Midtrans. Silakan coba lagi.";

export const loadSnap = () => {
  if (window.snap) return Promise.resolve(window.snap);
  if (loading) return loading;
  loading = api.get("/payments/config").catch(() => { loading = null; throw new Error(OPEN_FAIL); }).then(({ data }) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = data.snap_url;
    s.setAttribute("data-client-key", data.client_key);
    s.onload = () => resolve(window.snap);
    s.onerror = () => { loading = null; reject(new Error(OPEN_FAIL)); };
    document.body.appendChild(s);
  }));
  return loading;
};

export const paySnap = async (token, handlers = {}) => {
  if (!token) throw new Error("Data pembayaran tidak ditemukan. Muat ulang halaman lalu coba lagi.");
  const snap = await loadSnap();
  snap.pay(token, {
    onSuccess: handlers.onDone,
    onPending: handlers.onDone,
    onError: handlers.onError,
    onClose: handlers.onDone,
  });
};
