import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import {
  FiLock, FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiUser, FiDollarSign, FiCreditCard, FiGlobe, FiEye, FiX,
  FiActivity, FiList, FiTarget, FiClock, FiArrowUpRight, FiArrowDownRight,
  FiDownload, FiSmartphone, FiZap, FiPower
} from "react-icons/fi";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (cents) => (Number(cents || 0) / 100).toFixed(2);

const fmtDateHeure = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

const getDuree = (debut, fin) => {
  const ms = new Date(fin || Date.now()) - new Date(debut);
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, "0")}`;
};

const ecartClass = (cents) => {
  if (!cents || cents === 0) return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
  return cents > 0
    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
};

const MoyenBadge = ({ moyen }) => {
  const map = {
    especes:        { label: "Espèces",        icon: FiDollarSign,  cls: "bg-emerald-100 text-emerald-700" },
    cb:             { label: "CB",             icon: FiCreditCard,  cls: "bg-blue-100 text-blue-700" },
    stripe_web:     { label: "Stripe Web",     icon: FiGlobe,       cls: "bg-indigo-100 text-indigo-700" },
    stripe_guichet: { label: "Stripe Guichet", icon: FiSmartphone,  cls: "bg-purple-100 text-purple-700" },
  };
  const m = map[moyen] || { label: moyen, icon: FiDollarSign, cls: "bg-slate-100 text-slate-700" };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${m.cls}`}>
      <Icon size={9} /> {m.label}
    </span>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminComptage() {
  const { showNotification } = useNotification();

  const [tab, setTab] = useState("sessions");
  const [sessions, setSessions] = useState([]);
  const [comptages, setComptages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Détail session
  const [detailSession, setDetailSession] = useState(null);
  const [detailTx, setDetailTx] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal comptage
  const [comptageModal, setComptageModal] = useState(null);
  const [comptageTransactions, setComptageTransactions] = useState([]);
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCb, setReelCb] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [savingComptage, setSavingComptage] = useState(false);

  // Modal caisses actives
  const [showCaissesActives, setShowCaissesActives] = useState(false);
  const [caissesActivesData, setCaissesActivesData] = useState([]);

  // ── Chargement initial ─────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from("caisses_vendeurs").select("*").order("created_at", { ascending: false }),
        supabase.from("comptages_caisse").select("*").order("created_at", { ascending: false }),
      ]);
      setSessions(s || []);
      setComptages(c || []);
    } catch {
      showNotification("Erreur chargement des caisses.", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchAll();
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email || ""));
  }, [fetchAll]);

  // ── Calcul théorique depuis comptabilite ───────────────────────────────────
  const computeTheorique = async (session) => {
    const { data, error } = await supabase
      .from("comptabilite")
      .select("montant_cents, moyen_paiement, type_mouvement")
      .eq("caisse_id", session.id);

    if (error) throw error;
    const txs = data || [];

    let especes = session.fond_caisse_initial_cents || 0;
    let cb = 0;
    let stripe = 0;

    txs.forEach((tx) => {
      const m = Number(tx.montant_cents) || 0;
      if (tx.moyen_paiement === "especes") especes += m;
      else if (tx.moyen_paiement === "cb") cb += m;
      else if (tx.moyen_paiement === "stripe_web" || tx.moyen_paiement === "stripe_guichet") stripe += m;
    });

    return { especes, cb, stripe, nbTx: txs.filter(t => t.type_mouvement === 'encaissement').length };
  };

  // ── Ouvrir modal de comptage ───────────────────────────────────────────────
  const handleOuvrirComptage = async (session, allSessions = null) => {
    try {
      const sessionsToQuery = allSessions || [session];
      const ids = sessionsToQuery.map(s => s.id);
      const [theoriques, { data: txData }] = await Promise.all([
        Promise.all(sessionsToQuery.map(s => computeTheorique(s))),
        supabase
          .from("comptabilite")
          .select("*")
          .in("caisse_id", ids)
          .order("created_at", { ascending: true }),
      ]);
      const combined = theoriques.reduce(
        (acc, t) => ({ especes: acc.especes + t.especes, cb: acc.cb + t.cb, stripe: acc.stripe + t.stripe, nbTx: (acc.nbTx || 0) + (t.nbTx || 0) }),
        { especes: 0, cb: 0, stripe: 0, nbTx: 0 }
      );
      setComptageModal({ session, theorique: combined });
      setComptageTransactions(txData || []);
      setReelEspeces("");
      setReelCb("");
      setCommentaire("");
    } catch {
      showNotification("Erreur calcul du théorique.", "error");
    }
  };

  // ── Clôture urgence (admin uniquement, sans comptage) ────────────────────
  const handleClotureForcee = async (sessions) => {
    const nb = sessions.length;
    const email = sessions[0]?.vendeur_email || '?';
    if (!window.confirm(`Clôturer de force ${nb > 1 ? `les ${nb} caisses` : 'la caisse'} de ${email} sans comptage ?\n\nCette action est irréversible.`)) return;
    try {
      const ids = sessions.map(s => s.id);
      const { data: nbCloturees, error } = await supabase.rpc('cloturer_caisses_urgence', { p_caisse_ids: ids });
      if (error) throw error;
      showNotification(`${nbCloturees > 0 ? nbCloturees : nb} caisse(s) clôturée(s) de force.`, "success");
      setSessions(prev => prev.map(s => ids.includes(s.id) ? { ...s, statut: 'cloturee' } : s));
      setCaissesActivesData(prev => {
        const updated = prev.map(d => ({
          ...d,
          sessions: d.sessions.filter(s => !ids.includes(s.id)),
          nbCaisses: d.sessions.filter(s => !ids.includes(s.id)).length,
          sessionTheoriques: (d.sessionTheoriques || []).filter(st => !ids.includes(st.session.id)),
        })).filter(d => d.sessions.length > 0);
        return updated;
      });
    } catch (err) {
      showNotification("Erreur clôture forcée : " + err.message, "error");
    }
  };

  // ── Ouvrir modal caisses actives ──────────────────────────────────────────
  const handleVoirCaissesActives = async () => {
    const open = sessions.filter(s => s.statut === "ouverte");
    if (open.length === 0) {
      showNotification("Aucune caisse ouverte en ce moment.", "info");
      return;
    }

    // Regrouper par vendeur_email
    const byVendeur = {};
    for (const s of open) {
      const email = s.vendeur_email || 'inconnu';
      if (!byVendeur[email]) byVendeur[email] = [];
      byVendeur[email].push(s);
    }

    const results = await Promise.all(
      Object.entries(byVendeur).map(async ([, vendeurSessions]) => {
        const theoriques = await Promise.all(vendeurSessions.map(s => computeTheorique(s)));
        const combined = theoriques.reduce(
          (acc, t) => ({ especes: acc.especes + t.especes, cb: acc.cb + t.cb, stripe: acc.stripe + t.stripe, nbTx: acc.nbTx + t.nbTx }),
          { especes: 0, cb: 0, stripe: 0, nbTx: 0 }
        );
        const sorted = [...vendeurSessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const sessionTheoriques = sorted.map((s, i) => ({ session: s, theorique: theoriques[vendeurSessions.indexOf(s)] }));
        return { session: sorted[0], sessions: vendeurSessions, theorique: combined, nbCaisses: vendeurSessions.length, sessionTheoriques };
      })
    );

    setCaissesActivesData(results);
    setShowCaissesActives(true);
  };

  // ── Enregistrer un comptage ────────────────────────────────────────────────
  const handleSaveComptage = async () => {
    if (!comptageModal) return;
    const { session, theorique } = comptageModal;

    if (reelEspeces === "" && reelCb === "") {
      return showNotification("Saisissez au moins un montant réel.", "info");
    }

    const reelEsp    = reelEspeces !== "" ? Math.round(parseFloat(reelEspeces) * 100) : null;
    const reelCbVal  = reelCb     !== "" ? Math.round(parseFloat(reelCb)      * 100) : null;
    const ecartEsp   = reelEsp   != null ? reelEsp   - theorique.especes : null;
    const ecartCbVal = reelCbVal != null ? reelCbVal - theorique.cb      : null;
    const hasEcart   = (ecartEsp != null && ecartEsp !== 0) || (ecartCbVal != null && ecartCbVal !== 0);

    setSavingComptage(true);
    try {
      const { error } = await supabase.from("comptages_caisse").insert({
        caisse_id:               session.id,
        vendeur_email:           session.vendeur_email,
        declencheur_email:       userEmail,
        theorique_especes_cents: theorique.especes,
        theorique_cb_cents:      theorique.cb,
        theorique_stripe_cents:  theorique.stripe,
        reel_especes_cents:      reelEsp,
        reel_cb_cents:           reelCbVal,
        ecart_especes_cents:     ecartEsp,
        ecart_cb_cents:          ecartCbVal,
        commentaire:             commentaire.trim() || null,
        statut:                  hasEcart ? "ecart_signale" : "valide",
      });
      if (error) throw error;

      showNotification(
        hasEcart ? "Comptage enregistré — écart détecté !" : "Comptage OK, aucun écart.",
        hasEcart ? "error" : "success"
      );
      setComptageModal(null);
      fetchAll();
    } catch (err) {
      showNotification("Erreur : " + err.message, "error");
    } finally {
      setSavingComptage(false);
    }
  };

  // ── Voir le détail des transactions d'une session ─────────────────────────
  const handleVoirDetail = async (session, allSessions = null) => {
    setDetailSession(session);
    setLoadingDetail(true);
    try {
      const ids = allSessions ? allSessions.map(s => s.id) : [session.id];
      const { data } = await supabase
        .from("comptabilite")
        .select("*")
        .in("caisse_id", ids)
        .order("created_at", { ascending: true });
      setDetailTx(data || []);
    } catch {
      showNotification("Erreur chargement des transactions.", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Export CSV des comptages ───────────────────────────────────────────────
  const exportComptagesCSV = () => {
    if (!comptages.length) return showNotification("Aucun comptage à exporter.", "info");
    const headers = ["Date","Vendeur","Déclenché par","Théo Espèces","Réel Espèces","Écart Espèces","Théo CB","Réel CB","Écart CB","Stripe","Commentaire","Statut"];
    const rows = comptages.map(c => [
      fmtDateHeure(c.created_at),
      c.vendeur_email,
      c.declencheur_email,
      fmt(c.theorique_especes_cents),
      fmt(c.reel_especes_cents),
      fmt(c.ecart_especes_cents),
      fmt(c.theorique_cb_cents),
      fmt(c.reel_cb_cents),
      fmt(c.ecart_cb_cents),
      fmt(c.theorique_stripe_cents),
      c.commentaire || "",
      c.statut,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const csv  = "﻿" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `comptages_caisse_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Filtres ────────────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter((s) => {
    if (filterStatut && s.statut !== filterStatut) return false;
    if (filterDate) {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      if (d !== filterDate) return false;
    }
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const openSessions      = sessions.filter(s => s.statut === "ouverte");
  const closedWithEcart   = sessions.filter(s => s.statut === "cloturee" && (Math.abs(s.ecart_especes_cents || 0) + Math.abs(s.ecart_cb_cents || 0)) > 5);
  const comptagesKo       = comptages.filter(c => c.statut === "ecart_signale");

  // ── Modal : calcul temps réel de l'écart ──────────────────────────────────
  const modalEcartEsp = comptageModal && reelEspeces !== ""
    ? Math.round(parseFloat(reelEspeces) * 100) - comptageModal.theorique.especes
    : null;
  const modalEcartCb = comptageModal && reelCb !== ""
    ? Math.round(parseFloat(reelCb) * 100) - comptageModal.theorique.cb
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-violet-500 rounded-2xl text-white shadow-lg shadow-violet-500/30">
              <FiTarget className="text-2xl" />
            </div>
            Gestion des Caisses
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Supervision complète — sessions, comptages en temps réel, écarts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleVoirCaissesActives}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm shadow-emerald-500/20 transition-all"
          >
            <FiZap size={14} />
            Caisses actives
            {openSessions.length > 0 && (
              <span className="bg-white/30 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
                {openSessions.length}
              </span>
            )}
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
          >
            <FiRefreshCw /> Rafraîchir
          </button>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caisses Ouvertes</p>
          <h3 className={`text-4xl font-black mt-1 ${openSessions.length > 0 ? "text-emerald-500" : "text-slate-300"}`}>
            {openSessions.length}
          </h3>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {openSessions.length > 0
              ? openSessions.map(s => s.vendeur_email.split("@")[0]).join(", ")
              : "Aucune caisse ouverte"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sessions Clôturées avec Écart</p>
          <h3 className={`text-4xl font-black mt-1 ${closedWithEcart.length > 0 ? "text-red-500" : "text-slate-300"}`}>
            {closedWithEcart.length}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {closedWithEcart.length > 0 ? "Vérification requise" : "Toutes les clôtures sont OK"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comptages Admin avec Écart</p>
          <h3 className={`text-4xl font-black mt-1 ${comptagesKo.length > 0 ? "text-orange-500" : "text-slate-300"}`}>
            {comptagesKo.length}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{comptages.length} comptage(s) total au total</p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: "sessions",  label: "Sessions de caisse",  Icon: FiList },
          { key: "comptages", label: "Comptages admin",      Icon: FiActivity },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 -mb-px transition-all ${
              tab === key
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════ ONGLET SESSIONS ══════════════ */}
      {tab === "sessions" && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-violet-500 dark:text-white"
            >
              <option value="">Toutes les sessions</option>
              <option value="ouverte">Ouvertes seulement</option>
              <option value="cloturee">Clôturées seulement</option>
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-violet-500 dark:text-white cursor-pointer"
            />
            {filterDate && (
              <button onClick={() => setFilterDate("")} className="text-xs text-slate-400 hover:text-slate-600 font-bold underline">
                Effacer la date
              </button>
            )}
            <span className="text-xs text-slate-400 font-medium ml-auto">
              {filteredSessions.length} session(s)
            </span>
          </div>

          {/* Tableau sessions */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-400 font-bold animate-pulse">Chargement…</div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-16 text-center">
                <FiList className="text-5xl text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">Aucune session.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Vendeur</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Ouverture</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Durée</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Fond initial</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Statut</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Écart clôture</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredSessions.map((session) => {
                      const ecartTotal = Math.abs(session.ecart_especes_cents || 0) + Math.abs(session.ecart_cb_cents || 0);
                      return (
                        <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          {/* Vendeur */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-black flex-shrink-0">
                                {(session.vendeur_email || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                  {session.vendeur_email.split("@")[0]}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{session.vendeur_email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Ouverture */}
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {fmtDateHeure(session.created_at)}
                          </td>

                          {/* Durée */}
                          <td className="p-4 text-sm font-mono text-slate-500 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <FiClock size={11} />
                              {getDuree(session.created_at, session.heure_cloture)}
                            </span>
                          </td>

                          {/* Fond initial */}
                          <td className="p-4 text-sm font-black text-slate-700 dark:text-slate-300">
                            {fmt(session.fond_caisse_initial_cents)} €
                          </td>

                          {/* Statut */}
                          <td className="p-4">
                            {session.statut === "ouverte" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-black">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Ouverte
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full text-xs font-black">
                                <FiLock size={10} /> Clôturée
                              </span>
                            )}
                          </td>

                          {/* Écart */}
                          <td className="p-4">
                            {session.statut === "cloturee" ? (
                              ecartTotal > 5 ? (
                                <div className="space-y-1">
                                  {session.ecart_especes_cents !== 0 && session.ecart_especes_cents != null && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                                      <FiAlertTriangle size={10} /> Esp: {fmt(session.ecart_especes_cents)} €
                                    </span>
                                  )}
                                  {session.ecart_cb_cents !== 0 && session.ecart_cb_cents != null && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                                      <FiAlertTriangle size={10} /> CB: {fmt(session.ecart_cb_cents)} €
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-black">
                                  <FiCheckCircle size={10} /> OK
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300 text-xs">En cours</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVoirDetail(session)}
                                title="Voir les transactions"
                                className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 transition-all"
                              >
                                <FiEye size={14} />
                              </button>
                              {session.statut === "ouverte" && (
                                <button
                                  onClick={() => handleOuvrirComptage(session)}
                                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-lg transition-all shadow-sm shadow-violet-500/20"
                                >
                                  Comptage
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ ONGLET COMPTAGES ══════════════ */}
      {tab === "comptages" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={exportComptagesCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-sm hover:scale-105 transition-all"
            >
              <FiDownload size={14} /> Exporter CSV
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {comptages.length === 0 ? (
              <div className="p-16 text-center">
                <FiActivity className="text-5xl text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">Aucun comptage admin effectué.</p>
                <p className="text-slate-400 text-sm mt-1">
                  Allez dans l'onglet "Sessions" et cliquez "Comptage" sur une caisse ouverte.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Date & Heure</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Vendeur</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Par</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Théo Esp.</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Réel Esp.</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Écart Esp.</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Théo CB</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Réel CB</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Écart CB</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Stripe</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {comptages.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{fmtDateHeure(c.created_at)}</td>
                        <td className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300">{(c.vendeur_email || "").split("@")[0]}</td>
                        <td className="p-4 text-xs text-slate-400">{(c.declencheur_email || "").split("@")[0]}</td>
                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 text-right">{fmt(c.theorique_especes_cents)} €</td>
                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 text-right">{c.reel_especes_cents != null ? fmt(c.reel_especes_cents) + " €" : "—"}</td>
                        <td className="p-4 text-right">
                          {c.ecart_especes_cents != null ? (
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${ecartClass(c.ecart_especes_cents)}`}>
                              {c.ecart_especes_cents >= 0 ? "+" : ""}{fmt(c.ecart_especes_cents)} €
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 text-right">{fmt(c.theorique_cb_cents)} €</td>
                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 text-right">{c.reel_cb_cents != null ? fmt(c.reel_cb_cents) + " €" : "—"}</td>
                        <td className="p-4 text-right">
                          {c.ecart_cb_cents != null ? (
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${ecartClass(c.ecart_cb_cents)}`}>
                              {c.ecart_cb_cents >= 0 ? "+" : ""}{fmt(c.ecart_cb_cents)} €
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-4 text-sm font-mono text-indigo-600 dark:text-indigo-400 text-right">{fmt(c.theorique_stripe_cents)} €</td>
                        <td className="p-4">
                          {c.statut === "ecart_signale" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-black">
                              <FiAlertTriangle size={10} /> Écart
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-black">
                              <FiCheckCircle size={10} /> OK
                            </span>
                          )}
                          {c.commentaire && (
                            <p className="text-[10px] text-slate-400 italic mt-1 max-w-[120px] truncate" title={c.commentaire}>
                              {c.commentaire}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ MODAL DÉTAIL SESSION ══════════════ */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/20">
              <div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <FiList className="text-violet-500" /> Transactions de la session
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  {detailSession.vendeur_email} — {fmtDateHeure(detailSession.created_at)}
                  {detailSession.heure_cloture && ` → ${fmtDateHeure(detailSession.heure_cloture)}`}
                </p>
              </div>
              <button onClick={() => setDetailSession(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:rotate-90 transition-all">
                <FiX />
              </button>
            </div>

            {/* Résumé */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-100 dark:border-slate-700">
              {[
                { label: "Fond initial",   val: fmt(detailSession.fond_caisse_initial_cents) + " €", color: "text-slate-700 dark:text-slate-300" },
                { label: "Statut",         val: detailSession.statut === "ouverte" ? "🟢 Ouverte" : "🔒 Clôturée", color: "text-slate-700 dark:text-slate-300" },
                { label: "Théo. Espèces",  val: detailSession.total_theorique_especes_cents != null ? fmt(detailSession.total_theorique_especes_cents) + " €" : "—", color: "text-emerald-600" },
                { label: "Théo. CB",       val: detailSession.total_theorique_cb_cents != null ? fmt(detailSession.total_theorique_cb_cents) + " €" : "—", color: "text-blue-600" },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</p>
                  <p className={`font-black text-base mt-0.5 ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="flex-1 overflow-y-auto">
              {loadingDetail ? (
                <div className="p-12 text-center text-slate-400 animate-pulse font-bold">Chargement…</div>
              ) : detailTx.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold">Aucune transaction dans cette session.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/30 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase">Heure</th>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase">Type</th>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase">Moyen</th>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase">Ticket</th>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase">Opérateur</th>
                      <th className="p-3 text-xs font-black text-slate-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {detailTx.map((tx) => {
                      const m = Number(tx.montant_cents) / 100;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                          <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="p-3 text-xs font-bold text-slate-700 dark:text-slate-300">{tx.type_mouvement}</td>
                          <td className="p-3"><MoyenBadge moyen={tx.moyen_paiement} /></td>
                          <td className="p-3 text-xs font-mono text-slate-500">
                            {tx.ticket_num ? (
                              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black">
                                #{tx.ticket_num}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-[10px] text-slate-400 truncate max-w-[100px]">{tx.operateur_email}</td>
                          <td className={`p-3 text-right text-sm font-black ${m < 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {m >= 0 ? "+" : ""}{m.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-900/30 border-t-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={5} className="p-3 text-xs font-black text-slate-500 uppercase">Total</td>
                      <td className={`p-3 text-right font-black text-base ${
                        detailTx.reduce((s, t) => s + Number(t.montant_cents), 0) >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {(detailTx.reduce((s, t) => s + Number(t.montant_cents), 0) / 100).toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL CAISSES ACTIVES ══════════════ */}
      {showCaissesActives && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/10 flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <FiZap className="text-emerald-500" /> Caisses actives en ce moment
                </h3>
                <p className="text-slate-500 text-sm mt-0.5">
                  {caissesActivesData.length} vendeur(s) actif(s) — {caissesActivesData.reduce((acc, d) => acc + d.nbCaisses, 0)} caisse(s) ouverte(s)
                </p>
              </div>
              <button onClick={() => setShowCaissesActives(false)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:rotate-90 transition-all">
                <FiX />
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {caissesActivesData.map(({ session, sessions, theorique, nbCaisses, sessionTheoriques }) => (
                <div key={session.vendeur_email} className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

                  {/* En-tête vendeur */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-sm">
                        {(session.vendeur_email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm">{session.vendeur_email.split("@")[0]}</p>
                        <p className="text-xs text-slate-400">{session.vendeur_email}</p>
                        {nbCaisses > 1 && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-[10px] font-black">
                            ⚠ {nbCaisses} caisses ouvertes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ouverte
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Depuis {getDuree(session.created_at, null)} — {fmtDateHeure(session.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Totaux combinés */}
                  <div className="grid grid-cols-3 gap-3 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                      <FiDollarSign className="text-emerald-500 mx-auto mb-1" size={16} />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Espèces</p>
                      <p className="font-black text-lg text-emerald-600">{fmt(theorique.especes)} €</p>
                      <p className="text-[9px] text-slate-400">fond inclus</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                      <FiCreditCard className="text-blue-500 mx-auto mb-1" size={16} />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">CB</p>
                      <p className="font-black text-lg text-blue-600">{fmt(theorique.cb)} €</p>
                      <p className="text-[9px] text-slate-400">terminal</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                      <FiGlobe className="text-indigo-500 mx-auto mb-1" size={16} />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Stripe</p>
                      <p className="font-black text-lg text-indigo-600">{fmt(theorique.stripe)} €</p>
                      <p className="text-[9px] text-slate-400">auto</p>
                    </div>
                  </div>

                  {/* Liste des caisses individuelles si plusieurs */}
                  {nbCaisses > 1 && (
                    <div className="mx-4 mb-3 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
                      <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                        Caisses individuelles — choisissez lesquelles fermer
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sessionTheoriques.map(({ session: s, theorique: th }) => (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                Caisse ouverte le {fmtDateHeure(s.created_at)}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Esp: <span className="text-emerald-600 font-bold">{fmt(th.especes)} €</span>
                                {' · '}CB: <span className="text-blue-600 font-bold">{fmt(th.cb)} €</span>
                                {' · '}Stripe: <span className="text-indigo-600 font-bold">{fmt(th.stripe)} €</span>
                                {' · '}<span className="text-slate-400">{th.nbTx} tx</span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleClotureForcee([s])}
                              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black transition-all"
                            >
                              <FiPower size={10} /> Clôturer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions globales */}
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowCaissesActives(false); handleVoirDetail(session, sessions); }}
                        className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                      >
                        <FiEye size={12} /> Voir les transactions
                      </button>
                      <button
                        onClick={() => { setShowCaissesActives(false); handleOuvrirComptage(session, sessions); }}
                        className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-violet-500/20"
                      >
                        <FiTarget size={12} /> Lancer le comptage
                      </button>
                    </div>
                    <button
                      onClick={() => handleClotureForcee(sessions)}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-red-500/20"
                    >
                      <FiPower size={12} /> CLÔTURE URGENCE {nbCaisses > 1 ? `TOUTES (${nbCaisses} caisses)` : ''} — Sans comptage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL COMPTAGE ══════════════ */}
      {comptageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/10 flex justify-between items-start shrink-0">
              <div>
                <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <FiTarget className="text-violet-500" /> Comptage de caisse
                </h3>
                <p className="text-slate-500 text-sm mt-0.5">
                  {comptageModal.session.vendeur_email.split("@")[0]} —
                  ouverte depuis <strong>{getDuree(comptageModal.session.created_at, null)}</strong>
                </p>
              </div>
              <button onClick={() => setComptageModal(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:rotate-90 transition-all">
                <FiX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Montants théoriques */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  Montants théoriques calculés automatiquement
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Espèces", val: comptageModal.theorique.especes, Icon: FiDollarSign, color: "text-emerald-600", note: "→ à compter" },
                    { label: "CB",      val: comptageModal.theorique.cb,      Icon: FiCreditCard, color: "text-blue-600",    note: "→ terminal" },
                    { label: "Stripe",  val: comptageModal.theorique.stripe,  Icon: FiGlobe,      color: "text-indigo-600",  note: "→ automatique" },
                  ].map(({ label, val, Icon, color, note }) => (
                    <div key={label} className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-2xl text-center">
                      <Icon className={`${color} mx-auto mb-1`} size={16} />
                      <p className="text-[10px] font-bold text-slate-400">{label}</p>
                      <p className={`font-black text-lg ${color}`}>{fmt(val)} €</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{note}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic mt-2">
                  * Stripe est traçable electroniquement — concentrez-vous sur espèces et CB.
                </p>
              </div>

              {/* Récap transactions du vendeur */}
              {comptageTransactions.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                    Transactions de la session ({comptageTransactions.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                    {comptageTransactions.map((tx) => {
                      const m = Number(tx.montant_cents) / 100;
                      const isNeg = m < 0;
                      return (
                        <div key={tx.id} className={`flex items-center justify-between px-3 py-2 text-xs ${isNeg ? "bg-red-50 dark:bg-red-900/10" : "bg-white dark:bg-slate-800"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-400 font-mono shrink-0">
                              {new Date(tx.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <MoyenBadge moyen={tx.moyen_paiement} />
                            {tx.ticket_num && (
                              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black shrink-0">
                                #{tx.ticket_num}
                              </span>
                            )}
                            {isNeg && tx.motif && (
                              <span className="text-red-500 truncate font-medium" title={tx.motif}>↩ {tx.motif}</span>
                            )}
                          </div>
                          <span className={`font-black shrink-0 ml-2 ${isNeg ? "text-red-500" : "text-emerald-600"}`}>
                            {m >= 0 ? "+" : ""}{m.toFixed(2)} €
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Total net */}
                  <div className="flex justify-between items-center mt-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl">
                    <span className="text-xs font-black text-slate-500 uppercase">Net encaissé</span>
                    <span className={`font-black text-sm ${
                      comptageTransactions.reduce((s, t) => s + Number(t.montant_cents), 0) >= 0
                        ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {(comptageTransactions.reduce((s, t) => s + Number(t.montant_cents), 0) / 100).toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}

              {/* Saisie réel */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Montant réel compté</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                      <FiDollarSign size={11} /> Espèces dans le tiroir (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reelEspeces}
                      onChange={(e) => setReelEspeces(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder={fmt(comptageModal.theorique.especes)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                      <FiCreditCard size={11} /> CB / Terminal (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reelCb}
                      onChange={(e) => setReelCb(e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder={fmt(comptageModal.theorique.cb)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Résultat temps réel */}
              {(modalEcartEsp != null || modalEcartCb != null) && (
                <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Résultat en temps réel</p>
                  <div className="grid grid-cols-2 gap-3">
                    {modalEcartEsp != null && (
                      <div className={`p-3 rounded-xl ${ecartClass(modalEcartEsp)}`}>
                        <p className="text-[10px] font-bold opacity-70 uppercase">Écart Espèces</p>
                        <p className="font-black text-lg flex items-center gap-1">
                          {modalEcartEsp >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}
                          {modalEcartEsp >= 0 ? "+" : ""}{fmt(modalEcartEsp)} €
                        </p>
                        <p className="text-[10px] font-bold opacity-60">
                          {modalEcartEsp === 0 ? "Parfait ✓" : modalEcartEsp > 0 ? "Surplus" : "Manquant"}
                        </p>
                      </div>
                    )}
                    {modalEcartCb != null && (
                      <div className={`p-3 rounded-xl ${ecartClass(modalEcartCb)}`}>
                        <p className="text-[10px] font-bold opacity-70 uppercase">Écart CB</p>
                        <p className="font-black text-lg flex items-center gap-1">
                          {modalEcartCb >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}
                          {modalEcartCb >= 0 ? "+" : ""}{fmt(modalEcartCb)} €
                        </p>
                        <p className="text-[10px] font-bold opacity-60">
                          {modalEcartCb === 0 ? "Parfait ✓" : modalEcartCb > 0 ? "Surplus" : "Manquant"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Commentaire */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Ex: Billet de 50€ mal rendu, billet suspect mis de côté…"
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>

            </div>

            {/* Boutons — fixés en bas */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex gap-3">
              <button
                onClick={() => setComptageModal(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveComptage}
                disabled={savingComptage || (reelEspeces === "" && reelCb === "")}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black transition-all shadow-lg shadow-violet-500/20"
              >
                {savingComptage ? "Enregistrement…" : "Enregistrer le comptage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
