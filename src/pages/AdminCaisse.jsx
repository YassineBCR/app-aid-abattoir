import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  FiCreditCard, FiDollarSign, FiCalendar,
  FiLock, FiMonitor, FiPrinter,
  FiDownload, FiDatabase, FiX, FiSearch,
  FiArrowUpRight, FiArrowDownRight, FiGlobe, FiPieChart,
  FiSmartphone, FiUser, FiFilter, FiTag, FiAlertTriangle
} from "react-icons/fi";

// ── Détermine la couleur et le libellé d'une ligne comptable ──────────────────
function getPaiementBadge(tx) {
  const montant = Number(tx.montant_cents);
  const isNegatif = montant < 0;

  if (isNegatif) {
    return (
      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 w-max">
        <FiArrowDownRight /> Annulation
      </span>
    );
  }

  switch (tx.type_mouvement) {
    case 'fond_caisse':
      return <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiLock /> Fond de Caisse</span>;
    case 'ajout_caisse':
      return <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiArrowUpRight /> Ajout Caisse</span>;
    default:
      break;
  }

  switch (tx.moyen_paiement) {
    case 'stripe_web':
      return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiGlobe /> Stripe Web</span>;
    case 'stripe_guichet':
      return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiSmartphone /> Stripe Guichet</span>;
    case 'cb':
      return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiCreditCard /> CB</span>;
    case 'especes':
      return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiDollarSign /> Espèces</span>;
    default:
      return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold w-max">{tx.moyen_paiement}</span>;
  }
}

export default function AdminCaisse() {
  const [transactions, setTransactions]       = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingDaily, setLoadingDaily]       = useState(true);
  const [loadingGlobal, setLoadingGlobal]     = useState(true);
  const [selectedDate, setSelectedDate]       = useState(new Date().toISOString().split('T')[0]);

  // Modale historique
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm]                 = useState("");
  const [filterMoyen, setFilterMoyen]               = useState("");
  const [filterType, setFilterType]                 = useState("");

  useEffect(() => { fetchGlobalTransactions(); }, []);
  useEffect(() => { fetchDailyTransactions(selectedDate); }, [selectedDate]);

  const fetchGlobalTransactions = async () => {
    try {
      setLoadingGlobal(true);
      const { data, error } = await supabase
        .from('comptabilite')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllTransactions(data || []);
    } catch (err) { console.error("Erreur chargement global :", err); }
    finally { setLoadingGlobal(false); }
  };

  const fetchDailyTransactions = async (dateStr) => {
    try {
      setLoadingDaily(true);
      const startOfDay = new Date(dateStr); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay   = new Date(dateStr); endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('comptabilite')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) { console.error("Erreur chargement jour :", err); }
    finally { setLoadingDaily(false); }
  };

  // ── Export CSV enrichi pour la nouvelle table comptabilite ─────────────────
  const handleExportCSV = (dataToExport, filename) => {
    if (!dataToExport || dataToExport.length === 0) return alert("Aucune donnée à exporter.");

    // En-têtes mis à jour pour correspondre exactement à la table comptabilite
    const headers = [
      "ID Transaction", 
      "Date & Heure", 
      "Type de Mouvement", 
      "Moyen de Paiement", 
      "Numéro Ticket",
      "Commande ID", 
      "Email Opérateur", 
      "Montant (€)", 
      "Motif", 
      "Notes", 
      "Référence Externe"
    ];

    const rows = dataToExport.map(tx => {
      // Conversion du montant en euros avec format français (virgule)
      const montant = (Number(tx.montant_cents) / 100).toFixed(2).replace('.', ',');
      
      return [
        tx.id || "",
        new Date(tx.created_at).toLocaleString('fr-FR'),
        tx.type_mouvement || "",
        tx.moyen_paiement || "",
        tx.ticket_num || "",
        tx.commande_id || "",
        tx.operateur_email || "",
        montant,
        tx.motif || "",
        tx.notes || "",
        tx.reference_externe || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"); // Formatage robuste pour éviter les bugs avec les points-virgules dans les notes
    });

    const csv   = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n"); // \uFEFF pour forcer l'UTF-8 sur Excel
    const blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const link  = document.createElement("a");
    link.href   = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Calculs globaux ────────────────────────────────────────────────────────
  const calcTotaux = (txList) => {
    let stripe = 0, cb = 0, especes = 0, entrees = 0, sorties = 0;
    txList.forEach(tx => {
      const m = (Number(tx.montant_cents) || 0) / 100;
      if (m >= 0) entrees += m; else sorties += m;
      if (tx.moyen_paiement === 'stripe_web' || tx.moyen_paiement === 'stripe_guichet') stripe  += m;
      else if (tx.moyen_paiement === 'cb')                                               cb      += m;
      else if (tx.moyen_paiement === 'especes')                                          especes += m;
    });
    return { stripe, cb, especes, entrees, sorties, net: entrees + sorties, physique: cb + especes };
  };

  const global = calcTotaux(allTransactions);
  const daily  = calcTotaux(transactions);

  // ── Opérateurs uniques ─────────────────────────────────────────────────────
  const operateurs = [...new Set(allTransactions.map(tx => tx.operateur_email).filter(Boolean))];

  // ── Filtres historique ─────────────────────────────────────────────────────
  const filteredHistory = allTransactions.filter(tx => {
    const s = searchTerm.toLowerCase();
    const matchSearch = (
      (tx.ticket_num ? `#${tx.ticket_num}` : "").toLowerCase().includes(s) ||
      (tx.operateur_email || "").toLowerCase().includes(s) ||
      (tx.motif || "").toLowerCase().includes(s) ||
      (tx.notes || "").toLowerCase().includes(s) ||
      (tx.reference_externe || "").toLowerCase().includes(s) ||
      new Date(tx.created_at).toLocaleString('fr-FR').includes(s)
    );
    const matchMoyen = !filterMoyen || tx.moyen_paiement === filterMoyen;
    const matchType  = !filterType  || tx.type_mouvement  === filterType;
    return matchSearch && matchMoyen && matchType;
  });

  const formatTime = (dateString, includeDate = false) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return includeDate
      ? date.toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in relative">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
              <FiLock className="text-2xl" />
            </div>
            Tableau de Bord Comptable
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Table <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">comptabilite</code> — chaque centime tracé, immuable.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all font-bold text-sm shadow-xl shadow-slate-800/20"
          >
            <FiDatabase /> Historique complet
          </button>
          <button
            onClick={fetchGlobalTransactions}
            className="px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── RAPPORT GLOBAL ── */}
      <div className="space-y-6">
        <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <FiGlobe className="text-blue-500" /> Rapport Global
          <span className="text-sm text-slate-400 font-medium ml-2">({allTransactions.length} lignes)</span>
        </h3>

        {loadingGlobal ? (
          <div className="h-32 flex items-center justify-center text-slate-500 font-bold animate-pulse">Calcul en cours…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Net global */}
              <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
                <div className="z-10">
                  <p className="text-xs font-bold text-blue-400 uppercase">Solde Net Global</p>
                  <h3 className="text-4xl font-black mt-2">{global.net.toFixed(2)} €</h3>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium z-10">{allTransactions.length} mouvements tracés</p>
                <FiPieChart className="absolute -right-4 -bottom-4 text-8xl text-white/5" />
              </div>

              {/* Caisse physique */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase text-center">Caisse Physique (CB + Espèces)</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2 text-center">{global.physique.toFixed(2)} €</h3>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-around">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Espèces</p>
                    <p className="font-black text-emerald-500 text-lg">{global.especes.toFixed(2)} €</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">CB</p>
                    <p className="font-black text-blue-500 text-lg">{global.cb.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              {/* Flux */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase text-center">Flux</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><FiArrowUpRight /> Entrées</span>
                    <span className="font-black text-emerald-600">+{global.entrees.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1"><FiArrowDownRight /> Sorties (annulations)</span>
                    <span className="font-black text-red-600">{global.sorties.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Stripe */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-3xl shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-xs font-bold text-indigo-500 uppercase">Total Stripe (Web + Guichet)</p>
                <h3 className="text-3xl font-black text-indigo-700 dark:text-indigo-400 mt-2">{global.stripe.toFixed(2)} €</h3>
                <div className="mt-4 text-xs text-indigo-400 font-bold flex items-center gap-1">
                  <FiMonitor /> Paiements en ligne
                </div>
              </div>
            </div>

            {/* Répartition par opérateur */}
            {operateurs.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><FiUser /> Encaissements par Opérateur</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {operateurs.map(op => {
                    const opTx = allTransactions.filter(tx => tx.operateur_email === op && tx.montant_cents > 0 && tx.type_mouvement === 'encaissement');
                    const total = opTx.reduce((s, tx) => s + Number(tx.montant_cents), 0) / 100;
                    return (
                      <div key={op} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 truncate">{op}</p>
                        <p className="font-black text-slate-700 dark:text-white text-lg">{total.toFixed(2)} €</p>
                        <p className="text-[10px] text-slate-400">{opTx.length} encaissements</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <hr className="border-2 border-dashed border-slate-200 dark:border-slate-700" />

      {/* ── RAPPORT JOURNALIER ── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <FiCalendar className="text-emerald-500" /> Comptabilité Journalière
          </h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-slate-800 dark:text-white font-bold cursor-pointer outline-none focus:border-emerald-500"
          />
        </div>

        {loadingDaily ? (
          <div className="h-32 flex flex-col items-center justify-center animate-pulse text-slate-500 font-bold">Calcul de la journée…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-6 rounded-3xl shadow-lg text-white flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Solde Net du Jour</p>
                  <h3 className="text-4xl font-black mt-2 text-emerald-400">{daily.net.toFixed(2)} €</h3>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">{transactions.length} mouvements</p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2 border-emerald-500 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase text-center">Caisse Physique Jour</p>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2 text-center">{daily.physique.toFixed(2)} €</h3>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-around">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Espèces</p>
                    <p className="font-black text-emerald-500 text-lg">{daily.especes.toFixed(2)} €</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">CB</p>
                    <p className="font-black text-blue-500 text-lg">{daily.cb.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-400 uppercase text-center">Flux du Jour</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><FiArrowUpRight /> Entrées</span>
                    <span className="font-black text-emerald-600">+{daily.entrees.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1"><FiArrowDownRight /> Sorties</span>
                    <span className="font-black text-red-600">{daily.sorties.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Stripe Jour</p>
                  <h3 className="text-3xl font-black text-indigo-600 mt-2">{daily.stripe.toFixed(2)} €</h3>
                </div>
              </div>
            </div>

            {/* Tableau journalier */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-800 dark:text-white text-lg">
                  Mouvements du {new Date(selectedDate).toLocaleDateString('fr-FR')}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportCSV(transactions, `compta_jour_${selectedDate}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-sm hover:scale-105 transition-all"
                  >
                    <FiDownload /> Exporter
                  </button>
                  <button onClick={() => window.print()} className="p-2 bg-white dark:bg-slate-700 rounded-xl text-slate-500 shadow-sm"><FiPrinter /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Heure</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Type / Moyen</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Ticket / Opérateur</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Motif / Notes</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {transactions.length === 0 ? (
                      <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-medium">Aucun mouvement ce jour.</td></tr>
                    ) : transactions.map(tx => {
                      const montant   = Number(tx.montant_cents) / 100;
                      const isNegatif = montant < 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm">{formatTime(tx.created_at)}</td>
                          <td className="p-4">{getPaiementBadge(tx)}</td>
                          <td className="p-4">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{tx.ticket_num ? `#${tx.ticket_num}` : "Opération Caisse"}</p>
                            <p className="text-[10px] text-slate-400">{tx.operateur_email}</p>
                          </td>
                          <td className="p-4">
                            {tx.motif && <p className="text-xs text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block">{tx.motif}</p>}
                            {tx.notes && !tx.motif && <p className="text-xs text-slate-500 italic truncate max-w-[150px]">{tx.notes}</p>}
                          </td>
                          <td className={`p-4 text-right font-black ${isNegatif ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                            {isNegatif ? '' : '+'}{montant.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ MODALE HISTORIQUE COMPLET ═══════════ */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-7xl h-full max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center gap-3">
                  <FiDatabase className="text-emerald-500" /> Comptabilité Complète
                </h3>
                <p className="text-slate-500 font-medium mt-1 text-sm">{filteredHistory.length} lignes affichées sur {allTransactions.length}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:rotate-90 transition-all self-end md:self-auto">
                <FiX className="text-xl" />
              </button>
            </div>

            {/* Filtres */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-3 bg-white dark:bg-slate-800">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <FiSearch className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Ticket, opérateur, motif, ref…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-slate-700 dark:text-white font-medium w-full outline-none"
                />
              </div>
              <select value={filterMoyen} onChange={e => setFilterMoyen(e.target.value)} className="px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 dark:text-white">
                <option value="">Tous les moyens</option>
                <option value="especes">Espèces</option>
                <option value="cb">CB</option>
                <option value="stripe_web">Stripe Web</option>
                <option value="stripe_guichet">Stripe Guichet</option>
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 dark:text-white">
                <option value="">Tous les types</option>
                <option value="encaissement">Encaissements</option>
                <option value="annulation">Annulations</option>
                <option value="fond_caisse">Fonds de caisse</option>
                <option value="ajout_caisse">Ajouts caisse</option>
                <option value="retrait_caisse">Retraits caisse</option>
              </select>
              <button
                onClick={() => handleExportCSV(filteredHistory, "comptabilite_export_complet")}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all"
              >
                <FiDownload /> Exporter CSV
              </button>
            </div>

            {/* Tableau */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Date & Heure</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Type / Moyen</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Ticket</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Opérateur</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Motif / Notes</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 hidden xl:table-cell">Référence Externe</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredHistory.map(tx => {
                    const montant   = Number(tx.montant_cents) / 100;
                    const isNegatif = montant < 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                          {formatTime(tx.created_at, true)}
                        </td>
                        <td className="p-4">{getPaiementBadge(tx)}</td>
                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300">
                          {tx.ticket_num ? <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">#{tx.ticket_num}</span> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-500 truncate max-w-[140px]">{tx.operateur_email}</td>
                        <td className="p-4">
                          {tx.motif && (
                            <div className="flex items-center gap-1">
                              <FiAlertTriangle className="text-red-400 text-xs shrink-0" />
                              <span className="text-xs text-red-600 dark:text-red-400 font-bold">{tx.motif}</span>
                            </div>
                          )}
                          {tx.notes && !tx.motif && <span className="text-xs text-slate-400 italic">{tx.notes}</span>}
                        </td>
                        <td className="p-4 text-[10px] font-mono text-slate-400 truncate max-w-[120px] hidden xl:table-cell" title={tx.reference_externe || ""}>
                          {tx.reference_externe ? tx.reference_externe.slice(0, 18) + '…' : '—'}
                        </td>
                        <td className={`p-4 text-right font-black ${isNegatif ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                          {isNegatif ? '' : '+'}{montant.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}