import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Send, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MessageBubble, AttachmentBar, OrderPicker } from "@/components/ChatParts";

const useChatMessages = (listUrl, active) => {
  const [msgs, setMsgs] = useState([]);
  const lastRef = useRef(null);

  const load = useCallback(async (reset = false) => {
    const after = reset ? undefined : lastRef.current || undefined;
    const { data } = await api.get(listUrl, { params: { after } });
    if (reset) setMsgs(data);
    else if (data.length) setMsgs((m) => [...m, ...data.filter((d) => !m.some((x) => x.message_id === d.message_id))]);
    if (data.length) lastRef.current = data[data.length - 1].created_at;
  }, [listUrl]);

  useEffect(() => {
    lastRef.current = null;
    setMsgs([]);
    if (!active) return;
    const fail = (e) => console.warn("Chat: gagal memuat pesan", e);
    load(true).catch(fail);
    const t = setInterval(() => load().catch(fail), 3000);
    return () => clearInterval(t);
  }, [load, active]);

  const append = (m) => { setMsgs((p) => [...p, m]); lastRef.current = m.created_at; };
  return { msgs, append };
};

export const ChatThread = ({ listUrl, sendUrl, mine, orders = null, active = true }) => {
  const { msgs, append } = useChatMessages(listUrl, active);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [pickOrder, setPickOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try { setImage((await api.post("/chat/upload", fd)).data.url); }
    catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    e.target.value = "";
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() && !image && !orderId) return;
    setBusy(true);
    try {
      const { data } = await api.post(sendUrl, { text, image_url: image, order_id: orderId });
      append(data);
      setText(""); setImage(null); setOrderId(null);
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengirim"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50" data-testid="chat-messages">
        {msgs.length === 0 && <p className="text-center text-xs text-muted-foreground py-10">Belum ada pesan. Mulai percakapan.</p>}
        {msgs.map((m) => <MessageBubble key={m.message_id} m={m} me={m.sender === mine} />)}
        <div ref={endRef} />
      </div>
      {(image || orderId) && <AttachmentBar image={image} orderId={orderId} onClearImage={() => setImage(null)} onClearOrder={() => setOrderId(null)} />}
      {pickOrder && orders && <OrderPicker orders={orders} onPick={(id) => { setOrderId(id); setPickOrder(false); }} />}
      <form onSubmit={send} className="flex items-center gap-1.5 p-2 border-t bg-white">
        <label className="p-2 text-muted-foreground hover:text-primary cursor-pointer" title="Kirim foto" data-testid="chat-image-label">
          <ImagePlus className="w-5 h-5" /><input type="file" accept="image/*" className="hidden" onChange={upload} data-testid="chat-image-input" />
        </label>
        {orders && <button type="button" data-testid="chat-order-btn" onClick={() => setPickOrder(!pickOrder)} className="p-2 text-muted-foreground hover:text-primary" title="Lampirkan pesanan"><Package className="w-5 h-5" /></button>}
        <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..." className="flex-1 h-10 px-3 rounded-full border text-sm outline-none focus:border-primary" />
        <button type="submit" disabled={busy} data-testid="chat-send-btn" className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
};
