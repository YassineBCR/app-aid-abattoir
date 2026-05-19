import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { sendPushToUser } from "../lib/pushNotifications";
import {
  FiMessageSquare, FiSend, FiX, FiChevronDown, FiHash, FiSmile,
  FiLock, FiArrowLeft, FiSearch, FiUsers
} from "react-icons/fi";

// ─── Son de notification ───────────────────────────────────────────────────
function playNotifSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  ["bg-violet-500","text-white"], ["bg-teal-500","text-white"],
  ["bg-orange-500","text-white"], ["bg-pink-500","text-white"],
  ["bg-blue-500","text-white"],   ["bg-emerald-500","text-white"],
  ["bg-rose-500","text-white"],   ["bg-indigo-500","text-white"],
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
  const d   = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
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
            <button key={i} onClick={() => onTicketClick(parseInt(m[1]))}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/30 hover:bg-white/50 font-black underline decoration-dotted transition-colors">
              <FiHash size={11} />{m[1]}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ─── Gestion des timestamps "lu" (localStorage) ───────────────────────────
const LS_KEY = "staffchat_read_ts";
function getReadTs()       { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function markRead(convKey) { const t = getReadTs(); t[convKey] = new Date().toISOString(); localStorage.setItem(LS_KEY, JSON.stringify(t)); }

const LOAD_LIMIT = 60;

export default function StaffChat({ changeTab }) {
  const { showNotification } = useNotification();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isOpen,      setIsOpen]      = useState(false);
  const [view,        setView]        = useState("list"); // "list" | "chat" | "picker"
  const [activeConv,  setActiveConv]  = useState(null);  // null | {type:"public"} | {type:"dm",id,email,name}

  // ── Data state ────────────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([]);
  const [conversations, setConversations] = useState([]); // DMs récents
  const [staffUsers,    setStaffUsers]    = useState([]);
  const [staffSearch,   setStaffSearch]   = useState("");

  // ── Form state ────────────────────────────────────────────────────────────
  const [input,     setInput]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [sendError, setSendError] = useState("");

  // ── Unread state ──────────────────────────────────────────────────────────
  const [unreadPublic, setUnreadPublic] = useState(0);
  const [unreadDms,    setUnreadDms]    = useState({}); // { userId: count }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);

  // ── Refs pour fermetures stables dans Realtime ────────────────────────────
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const isOpenRef       = useRef(false);
  const currentUserRef  = useRef(null);
  const activeConvRef   = useRef(null);

  useEffect(() => { isOpenRef.current      = isOpen;      }, [isOpen]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeConvRef.current  = activeConv;  }, [activeConv]);

  // ── Charger l'utilisateur courant ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUser(user); });
  }, []);

  // ── Charger la liste des membres du staff (pour le picker) ────────────────
  const loadStaffUsers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles").select("id, email, role")
      .neq("role", "client").order("role");
    setStaffUsers(data || []);
  }, []);

  useEffect(() => { loadStaffUsers(); }, [loadStaffUsers]);

  // ── Charger les messages d'une conversation ───────────────────────────────
  const loadMessages = useCallback(async (conv) => {
    if (!conv) return;
    setLoading(true);
    setMessages([]);
    let data;
    if (conv.type === "public") {
      ({ data } = await supabase
        .from("chat_messages").select("*")
        .is("recipient_id", null)
        .order("created_at", { ascending: false }).limit(LOAD_LIMIT));
    } else {
      const myId = currentUserRef.current?.id;
      ({ data } = await supabase
        .from("chat_messages").select("*")
        .or(`and(user_id.eq.${myId},recipient_id.eq.${conv.id}),and(user_id.eq.${conv.id},recipient_id.eq.${myId})`)
        .order("created_at", { ascending: false }).limit(LOAD_LIMIT));
    }
    if (data) setMessages(data.reverse());
    setLoading(false);
    // Marquer comme lu
    const ck = conv.type === "public" ? "public" : conv.id;
    markRead(ck);
    if (conv.type === "public") setUnreadPublic(0);
    else setUnreadDms(prev => { const n = { ...prev }; delete n[conv.id]; return n; });
  }, []);

  // ── Construire la liste des conversations DM depuis l'historique ──────────
  const loadConversations = useCallback(async () => {
    const myId = currentUserRef.current?.id;
    if (!myId) return;
    const { data } = await supabase
      .from("chat_messages").select("*")
      .or(`user_id.eq.${myId},recipient_id.eq.${myId}`)
      .not("recipient_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!data) return;

    const readTs  = getReadTs();
    const convMap = {};
    data.forEach(msg => {
      const otherId    = msg.user_id === myId ? msg.recipient_id   : msg.user_id;
      const otherEmail = msg.user_id === myId ? msg.recipient_email : msg.user_email;
      const otherName  = msg.user_id === myId
        ? (msg.recipient_email?.split("@")[0] || "?")
        : (msg.display_name || msg.user_email?.split("@")[0] || "?");

      if (!convMap[otherId]) {
        convMap[otherId] = { id: otherId, email: otherEmail, name: otherName, lastMsg: msg.message, lastTime: msg.created_at, unread: 0 };
      }
      const lastRead = readTs[otherId];
      if (msg.user_id !== myId && (!lastRead || new Date(msg.created_at) > new Date(lastRead))) {
        convMap[otherId].unread++;
      }
    });

    const sorted = Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    setConversations(sorted);
    const dmsUnread = {};
    sorted.forEach(c => { if (c.unread > 0) dmsUnread[c.id] = c.unread; });
    setUnreadDms(dmsUnread);
  }, []);

  // ── Charger le nombre de messages publics non lus ─────────────────────────
  const loadPublicUnread = useCallback(async () => {
    const lastRead = getReadTs()["public"];
    if (!lastRead) return;
    const { count } = await supabase
      .from("chat_messages").select("*", { count: "exact", head: true })
      .is("recipient_id", null)
      .gt("created_at", lastRead)
      .neq("user_id", currentUserRef.current?.id || "");
    setUnreadPublic(count || 0);
  }, []);

  useEffect(() => {
    if (currentUser) { loadConversations(); loadPublicUnread(); }
  }, [currentUser, loadConversations, loadPublicUnread]);

  // ── Abonnement Realtime (tous les messages me concernant) ─────────────────
  useEffect(() => {
    const channel = supabase
      .channel("staff_chat_v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg    = payload.new;
        const myId   = currentUserRef.current?.id;
        const conv   = activeConvRef.current;
        const fromMe = msg.user_id === myId;

        // Est-ce que ce message appartient à la conversation active ?
        const isCurrentConv =
          (conv?.type === "public" && !msg.recipient_id) ||
          (conv?.type === "dm" && (
            (msg.user_id === myId && msg.recipient_id === conv.id) ||
            (msg.user_id === conv.id && msg.recipient_id === myId)
          ));

        if (isCurrentConv && isOpenRef.current) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (!fromMe) markRead(conv.type === "public" ? "public" : conv.id);
          return;
        }

        if (fromMe) return; // Mes propres messages déjà gérés ci-dessus

        // Message public non actif
        if (!msg.recipient_id) {
          setUnreadPublic(n => n + 1);
          if (!isOpenRef.current) {
            playNotifSound();
            const name    = msg.display_name || msg.user_email?.split("@")[0];
            const preview = msg.message.length > 50 ? msg.message.slice(0, 50) + "…" : msg.message;
            showNotification(`💬 ${name} : ${preview}`, "info");
          }
          return;
        }

        // Message privé destiné à moi
        if (msg.recipient_id === myId) {
          playNotifSound();
          setUnreadDms(prev => ({ ...prev, [msg.user_id]: (prev[msg.user_id] || 0) + 1 }));
          setConversations(prev => {
            const existing = prev.find(c => c.id === msg.user_id);
            const updated  = {
              id: msg.user_id, email: msg.user_email,
              name: msg.display_name || msg.user_email?.split("@")[0] || "?",
              lastMsg: msg.message, lastTime: msg.created_at,
              unread: (existing?.unread || 0) + 1,
            };
            return [updated, ...prev.filter(c => c.id !== msg.user_id)];
          });
          const name    = msg.display_name || msg.user_email?.split("@")[0];
          const preview = msg.message.length > 45 ? msg.message.slice(0, 45) + "…" : msg.message;
          showNotification(`🔒 ${name} (privé) : ${preview}`, "info");
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("Chat realtime error — retrying...");
      });
    return () => { supabase.removeChannel(channel); };
  }, [showNotification]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && view === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, view]);

  // ── Ouvrir / fermer ───────────────────────────────────────────────────────
  const handleToggle = () => {
    setIsOpen(o => {
      if (!o) {
        setView("list");
        setActiveConv(null);
        loadConversations();
        loadPublicUnread();
      }
      return !o;
    });
  };

  const openConversation = (conv) => {
    setActiveConv(conv);
    setView("chat");
    setMessages([]);
    loadMessages(conv);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  // ── Envoyer un message ────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    if (!currentUser) { setSendError("Utilisateur non chargé, rechargez la page."); return; }
    setSending(true);
    setSendError("");
    try {
      const payload = {
        user_id:      currentUser.id,
        user_email:   currentUser.email,
        display_name: displayName(currentUser.email),
        message:      text,
      };
      if (activeConv?.type === "dm") {
        payload.recipient_id    = activeConv.id;
        payload.recipient_email = activeConv.email;
      }
      const { error } = await supabase.from("chat_messages").insert(payload);
      if (error) throw error;
      setInput("");

      // ── Notification push ──────────────────────────────────────────────────
      const senderName = displayName(currentUser.email);
      if (activeConv?.type === "dm") {
        // Push uniquement au destinataire
        sendPushToUser({
          userId: activeConv.id,
          title:  `💬 ${senderName} (message privé)`,
          body:   text.length > 80 ? text.slice(0, 80) + '…' : text,
          tag:    `dm-${currentUser.id}`,
        });
        setConversations(prev => {
          const updated = { ...activeConv, lastMsg: text, lastTime: new Date().toISOString(), unread: 0 };
          return [updated, ...prev.filter(c => c.id !== activeConv.id)];
        });
      } else {
        // Canal public → push à tout le staff (sauf l'expéditeur)
        const otherStaff = staffUsers
          .filter(u => u.id !== currentUser.id)
          .map(u => u.id);
        if (otherStaff.length > 0) {
          sendPushToUser({
            userIds: otherStaff,
            title:   `📢 ${senderName} — Canal Staff`,
            body:    text.length > 80 ? text.slice(0, 80) + '…' : text,
            tag:     'public-chat',
          });
        }
      }
    } catch (err) {
      setSendError(err.message || "Erreur d'envoi");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Clic sur #ticket ──────────────────────────────────────────────────────
  const handleTicketClick = (ticketNum) => {
    if (!changeTab) return;
    sessionStorage.setItem("tableau_search_ticket", ticketNum.toString());
    changeTab("tableau");
    setIsOpen(false);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalUnread  = unreadPublic + Object.values(unreadDms).reduce((a, b) => a + b, 0);
  const isMe         = (email) => email === currentUser?.email;
  const grouped      = messages.reduce((acc, msg, i) => {
    const prev    = messages[i - 1];
    const isFirst = !prev || prev.user_email !== msg.user_email ||
      new Date(msg.created_at) - new Date(prev.created_at) > 5 * 60 * 1000;
    acc.push({ ...msg, isFirst });
    return acc;
  }, []);
  const filteredStaff = staffUsers.filter(u =>
    u.id !== currentUser?.id && (
      !staffSearch ||
      u.email?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      displayName(u.email).toLowerCase().includes(staffSearch.toLowerCase())
    )
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Fenêtre de chat ── */}
      <div
        className={`fixed bottom-20 left-4 z-[80] flex flex-col transition-all duration-300 ease-out origin-bottom-left
          ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
        style={{ width: 400, height: 560 }}
      >
        <div className="flex flex-col h-full rounded-2xl shadow-2xl shadow-slate-900/30 overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">

          {/* ══════════════════════════════════════════
              VUE : LISTE DES CONVERSATIONS
          ══════════════════════════════════════════ */}
          {view === "list" && (
            <>
              <div className="shrink-0 bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <FiMessageSquare className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="font-black text-white text-sm leading-tight">Staff Chat</p>
                    <p className="text-teal-200 text-[11px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> En ligne
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setView("picker"); setStaffSearch(""); }}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" title="Nouveau message privé">
                    <FiLock size={15} />
                  </button>
                  <button onClick={handleToggle} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                    <FiChevronDown size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
                {/* Canal public */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Canal</p>
                  <button onClick={() => openConversation({ type: "public" })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                      <FiUsers size={18} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold text-slate-800 dark:text-white text-sm">Canal Public</p>
                      <p className="text-xs text-slate-400">Messages visibles par toute l'équipe</p>
                    </div>
                    {unreadPublic > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1 bg-teal-500 text-white text-[11px] font-black rounded-full flex items-center justify-center">
                        {unreadPublic > 99 ? "99+" : unreadPublic}
                      </span>
                    )}
                  </button>
                </div>

                {/* Messages privés */}
                <div className="p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Messages Privés</p>
                  {conversations.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <FiLock size={28} className="mx-auto mb-3 opacity-30" />
                      <p className="text-xs font-medium">Aucune conversation privée.</p>
                      <button onClick={() => { setView("picker"); setStaffSearch(""); }}
                        className="mt-3 text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">
                        + Démarrer un message privé
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {conversations.map(conv => {
                        const [bg, fg]  = avatarColor(conv.email);
                        const dmUnread  = unreadDms[conv.id] || 0;
                        return (
                          <button key={conv.id} onClick={() => openConversation({ type: "dm", ...conv })}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all">
                            <div className={`relative w-10 h-10 rounded-full ${bg} ${fg} flex items-center justify-center font-black text-sm shrink-0`}>
                              {(conv.name || "?")[0].toUpperCase()}
                              {dmUnread > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className={`font-bold text-sm truncate ${dmUnread > 0 ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                                {conv.name}
                              </p>
                              <p className={`text-xs truncate ${dmUnread > 0 ? "text-slate-600 dark:text-slate-300 font-medium" : "text-slate-400"}`}>
                                {conv.lastMsg}
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span className="text-[10px] text-slate-400">{fmtTime(conv.lastTime)}</span>
                              {dmUnread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                  {dmUnread > 99 ? "99+" : dmUnread}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                <button onClick={() => { setView("picker"); setStaffSearch(""); }}
                  className="w-full py-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 font-bold text-sm hover:bg-teal-100 dark:hover:bg-teal-900/40 flex items-center justify-center gap-2 transition-colors border border-teal-200 dark:border-teal-800/50">
                  <FiLock size={14} /> Nouveau message privé
                </button>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              VUE : SÉLECTION DU DESTINATAIRE (PICKER)
          ══════════════════════════════════════════ */}
          {view === "picker" && (
            <>
              <div className="shrink-0 bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3 flex items-center gap-3">
                <button onClick={() => setView("list")} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <FiArrowLeft size={18} />
                </button>
                <div>
                  <p className="font-black text-white text-sm">Nouveau message privé</p>
                  <p className="text-teal-200 text-[11px]">Sélectionner un destinataire</p>
                </div>
              </div>

              <div className="shrink-0 p-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Rechercher un membre..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white placeholder-slate-400"
                    autoFocus />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                {filteredStaff.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Aucun membre trouvé.</div>
                ) : filteredStaff.map(u => {
                  const [bg, fg] = avatarColor(u.email);
                  const name     = displayName(u.email);
                  const existing = conversations.find(c => c.id === u.id);
                  return (
                    <button key={u.id}
                      onClick={() => openConversation({ type: "dm", id: u.id, email: u.email, name: existing?.name || name })}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-left">
                      <div className={`w-10 h-10 rounded-full ${bg} ${fg} flex items-center justify-center font-black text-sm shrink-0`}>
                        {name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{name}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                        {(u.role || "").replace("_", " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              VUE : MESSAGES D'UNE CONVERSATION
          ══════════════════════════════════════════ */}
          {view === "chat" && (
            <>
              {/* Header */}
              <div className={`shrink-0 px-4 py-3 flex items-center gap-3
                ${activeConv?.type === "dm"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600"
                  : "bg-gradient-to-r from-teal-600 to-teal-500"}`}>
                <button onClick={() => { setView("list"); setActiveConv(null); setMessages([]); }}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <FiArrowLeft size={18} />
                </button>
                {activeConv?.type === "dm" ? (
                  <>
                    {(() => { const [bg, fg] = avatarColor(activeConv.email); return (
                      <div className={`w-8 h-8 rounded-full ${bg} ${fg} flex items-center justify-center font-black text-xs shrink-0`}>
                        {(activeConv.name || "?")[0].toUpperCase()}
                      </div>
                    ); })()}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">{activeConv.name}</p>
                      <p className="text-indigo-200 text-[11px] flex items-center gap-1">
                        <FiLock size={9} /> Message privé · visible uniquement par vous deux
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <FiUsers size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm">Canal Public</p>
                      <p className="text-teal-200 text-[11px]">Toute l'équipe</p>
                    </div>
                  </>
                )}
                <button onClick={handleToggle} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <FiChevronDown size={18} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-slate-50 dark:bg-slate-900/50"
                style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.07) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
                {loading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
                  </div>
                )}
                {!loading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                    <FiSmile size={32} className="opacity-40" />
                    <p className="text-sm font-medium">Aucun message</p>
                    <p className="text-xs">
                      {activeConv?.type === "dm" ? `Démarrez la discussion avec ${activeConv.name}` : "Commencez la discussion !"}
                    </p>
                  </div>
                )}
                {grouped.map(msg => {
                  const mine  = isMe(msg.user_email);
                  const [bg, fg] = avatarColor(msg.user_email);
                  const isDM  = activeConv?.type === "dm";
                  return (
                    <div key={msg.id}
                      className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${msg.isFirst ? "mt-3" : "mt-0.5"}`}>
                      {msg.isFirst ? (
                        <div className={`shrink-0 w-7 h-7 rounded-full ${bg} ${fg} flex items-center justify-center text-[11px] font-black mt-auto mb-0.5`}>
                          {(msg.display_name || msg.user_email || "?")[0].toUpperCase()}
                        </div>
                      ) : <div className="shrink-0 w-7" />}
                      <div className={`flex flex-col max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                        {msg.isFirst && (
                          <div className={`flex items-center gap-2 mb-0.5 px-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                              {mine ? "Moi" : (msg.display_name || msg.user_email?.split("@")[0])}
                            </span>
                            <span className="text-[10px] text-slate-400">{fmtTime(msg.created_at)}</span>
                          </div>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                          ${mine
                            ? isDM
                              ? "bg-indigo-500 text-white rounded-tr-sm"
                              : "bg-teal-500 text-white rounded-tr-sm"
                            : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm rounded-tl-sm border border-slate-100 dark:border-slate-600"
                          }`}>
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
              <form onSubmit={handleSend}
                className="shrink-0 flex flex-col gap-1 px-3 py-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                {sendError && <p className="text-xs text-red-500 font-bold px-1">{sendError}</p>}
                <div className="flex items-center gap-2">
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                    placeholder={activeConv?.type === "dm"
                      ? `Message à ${activeConv.name}…`
                      : "Message… utilisez #123 pour un ticket"}
                    maxLength={2000}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500/40 transition-all" />
                  <button type="submit" disabled={!input.trim() || sending}
                    className={`shrink-0 w-9 h-9 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md
                      ${activeConv?.type === "dm"
                        ? "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/30"
                        : "bg-teal-500 hover:bg-teal-600 shadow-teal-500/30"}`}>
                    <FiSend size={15} />
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>

      {/* ── Bouton flottant ── */}
      <button onClick={handleToggle}
        className={`fixed bottom-4 left-4 z-[80] w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300
          ${isOpen
            ? "bg-slate-700 dark:bg-slate-600 shadow-slate-700/40"
            : "bg-gradient-to-br from-teal-500 to-teal-600 shadow-teal-500/40 hover:scale-105 active:scale-95"}`}>
        {isOpen
          ? <FiChevronDown className="text-white" size={22} />
          : <FiMessageSquare className="text-white" size={22} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[11px] font-black rounded-full flex items-center justify-center animate-bounce shadow-md">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
    </>
  );
}
