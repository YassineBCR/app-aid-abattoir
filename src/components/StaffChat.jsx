import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  FiMessageSquare, FiSend, FiX, FiChevronDown, FiHash, FiSmile
} from "react-icons/fi";

// ─── Couleurs d'avatar déterministes par email ─────────────────────────────
const AVATAR_COLORS = [
  ["bg-violet-500", "text-white"],
  ["bg-teal-500",   "text-white"],
  ["bg-orange-500", "text-white"],
  ["bg-pink-500",   "text-white"],
  ["bg-blue-500",   "text-white"],
  ["bg-emerald-500","text-white"],
  ["bg-rose-500",   "text-white"],
  ["bg-indigo-500", "text-white"],
];
function avatarColor(email) {
  let h = 0;
  for (let i = 0; i < (email || "").length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function displayName(email) {
  if (!email) return "?";
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isSameDay = d.toDateString() === now.toDateString();
  if (isSameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " +
         d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Rendu d'un message avec détection des #numéros ───────────────────────
function MessageText({ text, onTicketClick }) {
  const parts = text.split(/(#\d+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/^#(\d+)$/);
        if (m) {
          return (
            <button
              key={i}
              onClick={() => onTicketClick(parseInt(m[1]))}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/30 hover:bg-white/50 font-black underline decoration-dotted transition-colors"
            >
              <FiHash size={11} />
              {m[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

const LOAD_LIMIT = 60;

export default function StaffChat({ changeTab }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [unread, setUnread]         = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading]       = useState(false);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const channelRef  = useRef(null);
  const isOpenRef   = useRef(false);

  // Garde isOpenRef synchronisé pour la subscription
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // ── Charger l'utilisateur courant ────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  // ── Charger les messages initiaux ────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LOAD_LIMIT);
    if (data) setMessages(data.reverse());
    setLoading(false);
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("staff_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          if (!isOpenRef.current) setUnread(n => n + 1);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // ── Ouvrir / fermer ──────────────────────────────────────────────────────
  const handleToggle = () => {
    setIsOpen(o => {
      if (!o) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 150); }
      return !o;
    });
  };

  // ── Envoyer un message ───────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !currentUser || sending) return;
    setSending(true);
    setInput("");
    await supabase.from("chat_messages").insert({
      user_id:      currentUser.id,
      user_email:   currentUser.email,
      display_name: displayName(currentUser.email),
      message:      text,
    });
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Clic sur ticket → ouvrir dans le registre ────────────────────────────
  const handleTicketClick = (ticketNum) => {
    if (!changeTab) return;
    sessionStorage.setItem("tableau_search_ticket", ticketNum.toString());
    changeTab("tableau");
    setIsOpen(false);
  };

  // ── Regroupement des messages consécutifs du même auteur ─────────────────
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const isFirst = !prev || prev.user_email !== msg.user_email ||
      new Date(msg.created_at) - new Date(prev.created_at) > 5 * 60 * 1000;
    acc.push({ ...msg, isFirst });
    return acc;
  }, []);

  const isMe = (email) => email === currentUser?.email;

  return (
    <>
      {/* ── Fenêtre de chat ── */}
      <div
        className={`fixed bottom-20 left-4 z-[80] flex flex-col transition-all duration-300 ease-out origin-bottom-left
          ${isOpen
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
          }`}
        style={{ width: 380, height: 520 }}
      >
        <div className="flex flex-col h-full rounded-2xl shadow-2xl shadow-slate-900/30 overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">

          {/* Header */}
          <div className="shrink-0 bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <FiMessageSquare className="text-white" size={18} />
              </div>
              <div>
                <p className="font-black text-white text-sm leading-tight">Staff Chat</p>
                <p className="text-teal-200 text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  En ligne
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <FiChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-slate-50 dark:bg-slate-900/50"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.07) 1px, transparent 0)", backgroundSize: "24px 24px" }}
          >
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                <FiSmile size={32} className="opacity-40" />
                <p className="text-sm font-medium">Pas encore de messages</p>
                <p className="text-xs">Commencez la discussion !</p>
              </div>
            )}
            {grouped.map((msg) => {
              const mine = isMe(msg.user_email);
              const [bg, fg] = avatarColor(msg.user_email);
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${msg.isFirst ? "mt-3" : "mt-0.5"}`}
                >
                  {/* Avatar */}
                  {msg.isFirst ? (
                    <div className={`shrink-0 w-7 h-7 rounded-full ${bg} ${fg} flex items-center justify-center text-[11px] font-black mt-auto mb-0.5`}>
                      {(msg.display_name || msg.user_email || "?")[0].toUpperCase()}
                    </div>
                  ) : (
                    <div className="shrink-0 w-7" />
                  )}

                  {/* Bulle */}
                  <div className={`flex flex-col max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                    {msg.isFirst && (
                      <div className={`flex items-center gap-2 mb-0.5 px-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                          {mine ? "Moi" : (msg.display_name || msg.user_email.split("@")[0])}
                        </span>
                        <span className="text-[10px] text-slate-400">{fmtTime(msg.created_at)}</span>
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                        ${mine
                          ? "bg-teal-500 text-white rounded-tr-sm"
                          : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm rounded-tl-sm border border-slate-100 dark:border-slate-600"
                        }`}
                    >
                      <MessageText text={msg.message} onTicketClick={handleTicketClick} />
                    </div>
                    {!msg.isFirst && (
                      <span className={`text-[10px] text-slate-400 mt-0.5 px-1 ${mine ? "text-right" : "text-left"}`}>
                        {fmtTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <form
            onSubmit={handleSend}
            className="shrink-0 flex items-center gap-2 px-3 py-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message… utilisez #123 pour un ticket"
              maxLength={2000}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="shrink-0 w-9 h-9 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-teal-500/30"
            >
              <FiSend size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Bouton flottant ── */}
      <button
        onClick={handleToggle}
        className={`fixed bottom-4 left-4 z-[80] w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300
          ${isOpen
            ? "bg-slate-700 dark:bg-slate-600 shadow-slate-700/40 rotate-0"
            : "bg-gradient-to-br from-teal-500 to-teal-600 shadow-teal-500/40 hover:scale-105 active:scale-95"
          }`}
      >
        {isOpen
          ? <FiChevronDown className="text-white" size={22} />
          : <FiMessageSquare className="text-white" size={22} />
        }
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[11px] font-black rounded-full flex items-center justify-center animate-bounce shadow-md">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </>
  );
}
