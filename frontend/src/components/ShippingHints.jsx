import { Snowflake, AlertTriangle } from "lucide-react";

export const isAddressIncomplete = (a) => !!a && (!a.district || !/^\d{5}$/.test(a.postal || ""));

export const ColdBadge = ({ className = "", testid }) => (
  <span data-testid={testid} title="Produk beku · hanya Kurir Toko"
    className={`inline-flex items-center gap-1 bg-sky-600/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm ${className}`}>
    <Snowflake className="w-3 h-3" /> Dikirim dingin
  </span>
);

export const ColdNote = ({ testid }) => (
  <p data-testid={testid} className="flex items-center gap-1.5 text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1.5">
    <Snowflake className="w-3.5 h-3.5 shrink-0" /> Produk beku · hanya Kurir Toko
  </p>
);

export const IncompleteAddressBanner = ({ count = 1, onFix, testid }) => (
  <div data-testid={testid} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
    <p className="text-xs flex-1">{count > 1 ? `${count} alamat` : "Alamat ini"} belum lengkap. Tambahkan <b>kecamatan & kode pos</b> agar bisa dikirim JNE/J&T/Paxel dan ongkir lebih akurat.</p>
    <button type="button" onClick={onFix} data-testid={`${testid}-fix`}
      className="shrink-0 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-full px-3 py-1 transition-colors">Lengkapi sekarang</button>
  </div>
);
