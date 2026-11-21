import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const warn = (label) => (e) => console.warn(`Checkout: gagal memuat ${label}`, e);

export const useCheckoutData = ({ open, user, hasFresh, hasCold, subtotal, weightGrams }) => {
  const [couriers, setCouriers] = useState([]);
  const [courier, setCourier] = useState(null);
  const [addr, setAddr] = useState({ name: "", phone: "", full: "", postal: "" });
  const [saved, setSaved] = useState([]);
  const [addrId, setAddrId] = useState("");
  const [balance, setBalance] = useState(0);
  const [availVouchers, setAvailVouchers] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  const pickAddress = useCallback((a) => {
    setAddrId(a.address_id);
    setAddr({ name: a.name, phone: a.phone, full: a.full, postal: a.postal || "", lat: a.lat, lng: a.lng, label: a.label,
      district: a.district || "", city: a.city || "", province: a.province || "", area_id: a.area_id || "", detail: a.detail || "" });
  }, []);

  useEffect(() => {
    if (!open) return;
    api.post("/shipping/rates", { has_fresh: hasFresh, has_cold: hasCold, weight: weightGrams, value: subtotal }).then(({ data }) => { setCouriers(data); setCourier(data[0] || null); }).catch(warn("kurir"));
    api.get("/vouchers").then(({ data }) => setAvailVouchers(data)).catch(warn("voucher"));
    if (!user) return;
    setAddr((a) => ({ ...a, name: a.name || user.name }));
    api.get("/wallet").then(({ data }) => setBalance(data.balance)).catch(warn("saldo"));
    api.get("/addresses").then(({ data }) => { setSaved(data); if (data[0]) pickAddress(data[0]); }).catch(warn("alamat"));
  }, [open, hasFresh, hasCold, user, pickAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const postal = (addr.postal || "").replace(/\D/g, "");
  useEffect(() => {
    if (!open || postal.length !== 5) return;
    setRatesLoading(true);
    api.post("/shipping/rates", { destination_postal_code: Number(postal), destination_area_id: addr.area_id || null, has_fresh: hasFresh, has_cold: hasCold, weight: weightGrams, value: subtotal })
      .then(({ data }) => { if (data?.length) { setCouriers(data); setCourier((prev) => data.find((o) => o.code === prev?.code) || data[0]); } })
      .catch(warn("tarif ongkir"))
      .finally(() => setRatesLoading(false));
  }, [postal, addr.area_id, open, hasFresh, hasCold, weightGrams, subtotal]);

  return { couriers, courier, setCourier, addr, setAddr, saved, addrId, pickAddress, balance, availVouchers, ratesLoading };
};
