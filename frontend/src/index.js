import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { queryClient } from "@/lib/queryClient";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

// PWA: daftarkan service worker (hanya di versi live, bukan saat development).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker gagal didaftarkan", e));
  });
}
