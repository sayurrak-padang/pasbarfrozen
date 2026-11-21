import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rsp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Logo diatur di brand.config.json (logoUrl). Diekspor ulang di sini agar impor lama tetap jalan.
export { LOGO_URL } from "@/config/brand";

export const fileUrl = (u) => (u && u.startsWith("/api/") ? `${BACKEND_URL}${u}` : u);

export const rupiah = (n) =>
  "Rp" + (n || 0).toLocaleString("id-ID");
