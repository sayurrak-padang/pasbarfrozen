import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Plus, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API, api } from "@/lib/api";
import { BRAND } from "@/config/brand";

const WEBHOOK = `${API}/webhooks/twilio/whatsapp`;

export const OwnerPhones = ({ phones, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (phones.length >= 5) { toast.error("Maksimal 5 nomor"); return; }
    onChange([...phones, v]);
    setDraft("");
  };
  return (
    <div className="border-t pt-3 space-y-2" data-testid="owner-phones">
      <h3 className="font-bold text-sm flex items-center gap-2"><BellRing className="w-4 h-4 text-primary" /> Notifikasi WhatsApp Pesanan Lunas</h3>
      <p className="text-[11px] text-muted-foreground">Nomor owner/staf yang menerima WhatsApp setiap ada pesanan lunas (QRIS, VA, Saldo).</p>
      <div className="flex flex-wrap gap-1.5">
        {phones.map((p) => (
          <span key={p} className="text-xs bg-emerald-50 border border-emerald-200 rounded-full pl-2.5 pr-1 py-0.5 flex items-center gap-1" data-testid={`owner-phone-${p}`}>
            {p}<button type="button" onClick={() => onChange(phones.filter((x) => x !== p))} data-testid={`owner-phone-remove-${p}`}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input data-testid="owner-phone-input" placeholder="08xx / +62xx" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" onClick={add} data-testid="owner-phone-add-btn"><Plus className="w-4 h-4" /> Tambah</Button>
      </div>
    </div>
  );
};

export const BiteshipWebhookGuide = () => {
  const { data } = useQuery({ queryKey: ["biteship-webhook"], queryFn: async () => (await api.get("/admin/settings/biteship-webhook")).data });
  const url = data?.url || "";
  return (
    <div className="border-t pt-3 space-y-1.5 text-[11px] text-muted-foreground" data-testid="biteship-webhook-guide">
      <h3 className="font-bold text-sm text-foreground">Webhook Biteship (status kurir otomatis)</h3>
      <ol className="list-decimal pl-4 space-y-0.5">
        <li>Buka dashboard.biteship.com → menu <b>Integrasi</b> → tab <b>Untuk Developer</b> → kartu <b>Webhook</b>.</li>
        <li>Klik <b>Tambah Webhook</b>, beri nama "{BRAND.shortName}", tempel URL di bawah, centang event <b>order.status</b>, <b>order.waybill_id</b>, <b>order.price</b>, lalu <b>Buat</b>.</li>
        <li>Pantau pengiriman di tab <b>Events Log</b>. URL ini rahasia, jangan dibagikan.</li>
      </ol>
      <div className="flex gap-2 items-center">
        <code className="flex-1 bg-slate-100 rounded px-2 py-1 break-all" data-testid="biteship-webhook-url">{url}</code>
        <Button type="button" size="sm" variant="outline" data-testid="biteship-webhook-copy" disabled={!url}
          onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("URL disalin"))}><Copy className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
};

export const TwilioBotGuide = () => (
  <div className="border-t pt-3 space-y-1.5 text-[11px] text-muted-foreground" data-testid="twilio-bot-guide">
    <h3 className="font-bold text-sm text-foreground">Bot WhatsApp Cek Pesanan</h3>
    <p>Pelanggan membalas <b>status</b> (pesanan terakhir) atau <b>pesanan</b> (3 terakhir). Aktifkan di Twilio Console:</p>
    <ol className="list-decimal pl-4 space-y-0.5">
      <li>Messaging → Senders → WhatsApp senders → pilih nomor pengirim Anda.</li>
      <li>Di "Webhook URL for incoming messages" tempel URL di bawah, metode <b>POST</b>, lalu Save.</li>
      <li>Akun Twilio harus aktif (bukan trial) dan sender WhatsApp sudah disetujui.</li>
    </ol>
    <div className="flex gap-2 items-center">
      <code className="flex-1 bg-slate-100 rounded px-2 py-1 break-all" data-testid="twilio-webhook-url">{WEBHOOK}</code>
      <Button type="button" size="sm" variant="outline" data-testid="twilio-webhook-copy"
        onClick={() => navigator.clipboard.writeText(WEBHOOK).then(() => toast.success("URL disalin"))}><Copy className="w-3.5 h-3.5" /></Button>
    </div>
  </div>
);
