import { Package, X } from "lucide-react";
import { fileUrl, rupiah } from "@/lib/api";

const time = (iso) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const MessageBubble = ({ m, me }) => (
  <div className={`flex ${me ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.message_id}`}>
    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${me ? "bg-primary text-white rounded-br-sm" : "bg-white rounded-bl-sm"}`}>
      {m.order_ref && (
        <div className={`mb-1 rounded-lg p-2 text-xs ${me ? "bg-white/15" : "bg-emerald-50"}`}>
          <p className="font-semibold flex items-center gap-1"><Package className="w-3 h-3" /> {m.order_ref.order_id}</p>
          <p>{m.order_ref.items} item · {rupiah(m.order_ref.total)} · {m.order_ref.status}</p>
        </div>
      )}
      {m.image_url && <a href={fileUrl(m.image_url)} target="_blank" rel="noreferrer"><img src={fileUrl(m.image_url)} alt="" className="rounded-lg max-h-48 mb-1" /></a>}
      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
      <p className={`text-[10px] mt-0.5 ${me ? "text-white/70" : "text-muted-foreground"}`}>{time(m.created_at)}</p>
    </div>
  </div>
);

export const AttachmentBar = ({ image, orderId, onClearImage, onClearOrder }) => (
  <div className="px-3 py-2 border-t flex gap-2 items-center text-xs bg-white">
    {image && <span className="relative"><img src={fileUrl(image)} alt="" className="w-12 h-12 rounded object-cover" /><button data-testid="chat-remove-image" onClick={onClearImage} className="absolute -top-1 -right-1 bg-white rounded-full shadow"><X className="w-3 h-3" /></button></span>}
    {orderId && <span className="bg-emerald-50 rounded px-2 py-1 flex items-center gap-1" data-testid="chat-attached-order"><Package className="w-3 h-3" /> {orderId}<button data-testid="chat-remove-order" onClick={onClearOrder}><X className="w-3 h-3" /></button></span>}
  </div>
);

export const OrderPicker = ({ orders, onPick }) => (
  <div className="max-h-40 overflow-y-auto border-t bg-white" data-testid="chat-order-picker">
    {orders.length === 0 && <p className="text-xs text-muted-foreground p-3">Belum ada pesanan.</p>}
    {orders.map((o) => (
      <button key={o.order_id} data-testid={`chat-pick-order-${o.order_id}`} onClick={() => onPick(o.order_id)} className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b">
        <b>{o.order_id}</b> · {rupiah(o.total)} · {o.status}
      </button>
    ))}
  </div>
);
