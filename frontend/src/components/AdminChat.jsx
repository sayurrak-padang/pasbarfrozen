import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { ChatThread } from "@/components/ChatThread";

export const AdminChat = () => {
  const [active, setActive] = useState(null);
  const { data: convs = [] } = useQuery({
    queryKey: ["admin-convs"], refetchInterval: 4000,
    queryFn: async () => (await api.get("/admin/chat/conversations")).data,
  });

  return (
    <div className="bg-white rounded-2xl border grid md:grid-cols-[280px_1fr] h-[70vh] overflow-hidden" data-testid="admin-chat">
      <div className={`border-r overflow-y-auto ${active ? "hidden md:block" : ""}`}>
        {convs.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">Belum ada chat masuk.</p>}
        {convs.map((c) => (
          <button key={c.conversation_id} data-testid={`admin-conv-${c.conversation_id}`} onClick={() => setActive(c)}
            className={`w-full text-left px-4 py-3 border-b flex gap-3 items-start hover:bg-emerald-50 ${active?.conversation_id === c.conversation_id ? "bg-emerald-50" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-primary font-bold flex items-center justify-center shrink-0">{c.user_name?.[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate flex-1">{c.user_name}</p>
                {c.unread_admin > 0 && active?.conversation_id !== c.conversation_id && <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5" data-testid={`admin-conv-unread-${c.conversation_id}`}>{c.unread_admin}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.last_sender === "admin" ? "Anda: " : ""}{c.last_message}</p>
            </div>
          </button>
        ))}
      </div>
      <div className={`flex flex-col min-h-0 ${active ? "" : "hidden md:flex"}`}>
        {active ? (
          <>
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <button className="md:hidden text-xs text-primary" onClick={() => setActive(null)} data-testid="admin-chat-back">Kembali</button>
              <div><p className="font-bold text-sm">{active.user_name}</p><p className="text-[11px] text-muted-foreground">{active.user_email}</p></div>
            </div>
            <ChatThread listUrl={`/admin/chat/${active.conversation_id}/messages`} sendUrl={`/admin/chat/${active.conversation_id}/messages`} mine="admin" />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm"><MessageCircle className="w-10 h-10 opacity-30 mb-2" />Pilih percakapan</div>
        )}
      </div>
    </div>
  );
};

export const useAdminUnread = () => {
  const { data: convs = [] } = useQuery({ queryKey: ["admin-convs"], refetchInterval: 4000, queryFn: async () => (await api.get("/admin/chat/conversations")).data });
  return convs.reduce((n, c) => n + (c.unread_admin || 0), 0);
};
