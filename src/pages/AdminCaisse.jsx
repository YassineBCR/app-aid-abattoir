import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiCalendar, FiDollarSign, FiCreditCard, FiFileText, FiActivity, 
  FiAlertTriangle, FiPrinter, FiRefreshCw, FiUser, FiUsers, FiPieChart, FiX, FiList, FiFilter, FiTrash2, FiCheckCircle 
} from "react-icons/fi";

export default function AdminCaisse() {
  const [loading, setLoading] = useState(true);
  
  const getTodayLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [dateSelectionnee, setDateSelectionnee] = useState(getTodayLocal());
  const [transactions, setTransactions] = useState([]);
  const [annulations, setAnnulations] = useState([]); 
  const [mergedList, setMergedList] = useState([]);
  const [totaux, setTotaux] = useState({ especes: 0, cb: 0, cheque: 0, total: 0 });
  const [vendeursStats, setVendeursStats] = useState({});

  // Filtres
  const [filterMode, setFilterMode] = useState("TOUS"); 
  const [filterAction, setFilterAction] = useState("TOUS"); 

  // Modal
  const [selectedVendeurEmail, setSelectedVendeurEmail] = useState(null);
  const [showVendeurModal, setShowVendeurModal] = useState(false);
  const [vendeurFilterMode, setVendeurFilterMode] = useState("TOUS");

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('caisse_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paiements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caisse_logs' }, () => fetchData()) 
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [dateSelectionnee]);

  // --- FUSION ET FILTRAGE ---
  useEffect(() => {
    let list = [];

    // 1. Transactions
    if (filterAction === "TOUS" || filterAction === "ENCAISSEMENT") {
        const trans = transactions.map(t => ({
            id: t.id,
            type: 'ENCAISSEMENT',
            date: t.created_at,
            montant: t.montant,
            moyen: t.moyen,
            ticket: t.ticket_trace || (t.commandes?.ticket_num) || "?",
            vendeur: t.vendeur_trace || (t.profiles?.email) || "Inconnu",
            details: "Paiement validé"
        }));
        list = [...list, ...trans];
    }

    // 2. Annulations (Correction Vendeur ici)
    if (filterAction === "TOUS" || filterAction === "ANNULATION") {
        const annuls = annulations.map(l => {
            let detectedMoyen = 'indefini';
            const det = (l.details || "").toLowerCase();
            if (det.includes('especes') || det.includes('espèces')) detectedMoyen = 'especes';
            else if (det.includes('cb') || det.includes('carte')) detectedMoyen = 'cb';
            else if (det.includes('cheque') || det.includes('chèque')) detectedMoyen = 'cheque';

            return {
                id: l.id,
                type: 'ANNULATION',
                date: l.created_at,
                montant: l.montant || 0,
                moyen: detectedMoyen, 
                ticket: 'Suppr.', 
                // Priorité au profil joint, sinon fallback
                vendeur: l.profiles?.email || "Système", 
                details: l.details
            };
        });
        list = [...list, ...annuls];
    }

    if (filterMode !== "TOUS") {
        list = list.filter(item => {
            if (item.type === 'ANNULATION') return true; 
            if (filterMode === 'cb') return item.moyen === 'cb' || item.moyen === 'stripe_online';
            return item.moyen === filterMode;
        });
    }

    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    setMergedList(list);

  }, [transactions, annulations, filterMode, filterAction]);


  async function fetchData() {
    setLoading(true);
    const start = new Date(dateSelectionnee); start.setHours(0, 0, 0, 0);
    const end = new Date(dateSelectionnee); end.setHours(23, 59, 59, 999);

    try {
      // 1. PAIEMENTS
      let paiementsData = [];
      const { data: dataFull, error: errFull } = await supabase
        .from("paiements")
        .select(`*, profiles:vendeur_id(email), commandes(ticket_num)`)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (!errFull) paiementsData = dataFull;
      else {
          const { data: dataMin } = await supabase.from("paiements").select("*").gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
          paiementsData = dataMin || [];
      }

      // 2. ANNULATIONS (Avec jointure staff_id vers profiles)
      let logsData = [];
      const { data: logsFull, error: errLogs } = await supabase
        .from("caisse_logs")
        .select(`*, profiles:staff_id(email)`) // <--- C'est ici que ça se joue pour le nom
        .eq("action", "ANNULATION")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (!errLogs) logsData = logsFull;
      else {
          // Fallback
          const { data: logsMin } = await supabase.from("caisse_logs").select("*").eq("action", "ANNULATION").gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
          logsData = logsMin || [];
      }

      // 3. CALCULS (Incluant les annulations par vendeur)
      const statsGlobales = { especes: 0, cb: 0, cheque: 0, total: 0 };
      const statsParVendeur = {};
      
      // A. Traitement des encaissements
      paiementsData.forEach(p => {
        const m = parseFloat(p.montant);
        const vEmail = p.vendeur_trace || p.profiles?.email || "Inconnu";

        statsGlobales.total += m;
        if (p.moyen === 'especes') statsGlobales.especes += m;
        else if (p.moyen === 'cheque') statsGlobales.cheque += m;
        else statsGlobales.cb += m;

        if (!statsParVendeur[vEmail]) statsParVendeur[vEmail] = { especes: 0, cb: 0, cheque: 0, total: 0, count: 0, annul_count: 0, annul_total: 0 };
        
        statsParVendeur[vEmail].total += m;
        statsParVendeur[vEmail].count += 1;
        if (p.moyen === 'especes') statsParVendeur[vEmail].especes += m;
        else if (p.moyen === 'cheque') statsParVendeur[vEmail].cheque += m;
        else statsParVendeur[vEmail].cb += m;
      });

      // B. Traitement des annulations (pour les stats vendeur)
      logsData.forEach(l => {
          const m = parseFloat(l.montant || 0);
          const vEmail = l.profiles?.email || "Système"; // Utilise l'email récupéré

          if (!statsParVendeur[vEmail]) statsParVendeur[vEmail] = { especes: 0, cb: 0, cheque: 0, total: 0, count: 0, annul_count: 0, annul_total: 0 };
          
          statsParVendeur[vEmail].annul_count += 1;
          statsParVendeur[vEmail].annul_total += m;
      });

      setTransactions(paiementsData);
      setAnnulations(logsData);
      setTotaux(statsGlobales);
      setVendeursStats(statsParVendeur);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const handlePrint = () => window.print();
  const openVendeurDetails = (email) => { setSelectedVendeurEmail(email); setVendeurFilterMode("TOUS"); setShowVendeurModal(true); };

  // Filtre modale
  const modalList = mergedList.filter(item => item.vendeur === selectedVendeurEmail);
  const filteredModalTransactions = modalList.filter(t => {
      if (vendeurFilterMode === "TOUS") return true;
      if (vendeurFilterMode === "cb") return t.moyen === "cb" || t.moyen === "stripe_online";
      return t.moyen === vendeurFilterMode;
  });

  return (
    <div className="space-y-8 p-4 md:p-8 animate-fade-in max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl text-white shadow-lg"><FiDollarSign className="text-2xl" /></div>
            Comptabilité Caisse
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Bilan journalier global et par vendeur.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <FiCalendar className="text-slate-400 ml-2" />
            <input type="date" value={dateSelectionnee} onChange={(e) => setDateSelectionnee(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none" />
            <button onClick={fetchData} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><FiRefreshCw className={loading ? 'animate-spin' : ''}/></button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={handlePrint} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold flex gap-2"><FiPrinter /> Imprimer</button>
        </div>
      </div>

      {/* --- TOTAUX --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-900">
            <div><p className="text-slate-400 font-bold uppercase text-xs">CA Total Validé</p><p className="text-4xl font-black mt-1">{totaux.total.toFixed(2)} €</p></div>
            <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center text-2xl"><FiActivity /></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border-l-4 border-green-500 flex justify-between">
            <div><p className="text-xs font-bold text-slate-400 uppercase">Espèces</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{totaux.especes.toFixed(2)} €</p></div><FiDollarSign className="text-green-200 text-3xl" />
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border-l-4 border-blue-500 flex justify-between">
            <div><p className="text-xs font-bold text-slate-400 uppercase">Carte Bancaire</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{totaux.cb.toFixed(2)} €</p></div><FiCreditCard className="text-blue-200 text-3xl" />
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow border-l-4 border-orange-500 flex justify-between">
            <div><p className="text-xs font-bold text-slate-400 uppercase">Chèque</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{totaux.cheque.toFixed(2)} €</p></div><FiFileText className="text-orange-200 text-3xl" />
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* --- VENDEURS (AVEC ALERTES SUPPRESSION) --- */}
      <div>
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><FiUsers className="text-indigo-500" /> Vendeurs (Cliquer pour détails)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(vendeursStats).length === 0 ? <div className="col-span-3 p-8 bg-slate-50 dark:bg-slate-900 rounded-xl text-center text-slate-400 italic">Aucune activité vendeur enregistrée.</div> : Object.entries(vendeursStats).map(([email, stats]) => (
                <button key={email} onClick={() => openVendeurDetails(email)} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col hover:scale-[1.02] transition-all text-left group">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center w-full">
                        <div className="flex items-center gap-3"><div className="bg-indigo-100 text-indigo-700 p-2 rounded-full"><FiUser /></div><div><p className="font-bold text-slate-800 dark:text-white text-sm">{email.split('@')[0]}</p><p className="text-xs text-slate-500">{stats.count} actes</p></div></div>
                        <span className="bg-slate-800 text-white px-3 py-1 rounded-lg font-bold text-sm">{stats.total.toFixed(2)} €</span>
                    </div>
                    <div className="p-4 space-y-2 w-full">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Espèces</span><span className="font-bold text-green-600">{stats.especes.toFixed(2)} €</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">CB</span><span className="font-bold text-blue-600">{stats.cb.toFixed(2)} €</span></div>
                        {/* ALERTE SUPPRESSION VENDEUR */}
                        {stats.annul_count > 0 && (
                            <div className="mt-3 pt-3 border-t border-dashed border-red-200 flex justify-between items-center text-xs text-red-600 bg-red-50 p-2 rounded">
                                <span className="flex items-center gap-1 font-bold"><FiAlertTriangle/> {stats.annul_count} Annulations</span>
                                <span className="font-bold">- {stats.annul_total.toFixed(2)} €</span>
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
      </div>

      {/* --- JOURNAL DES MOUVEMENTS --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-8">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiList /> Journal des Mouvements</h3>
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                    <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 dark:text-white cursor-pointer appearance-none">
                        <option value="TOUS">Toutes Actions</option><option value="ENCAISSEMENT">✅ Encaissements</option><option value="ANNULATION">🗑️ Annulations</option>
                    </select>
                </div>
                <div className="relative flex-1 md:flex-none">
                    <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 dark:text-white cursor-pointer appearance-none">
                        <option value="TOUS">Tous Modes</option><option value="especes">💵 Espèces</option><option value="cb">💳 Carte</option><option value="cheque">📝 Chèque</option>
                    </select>
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 uppercase text-xs bg-slate-50/50 dark:bg-slate-900/20">
                        <th className="p-4">Heure</th><th className="p-4">Action</th><th className="p-4">Ticket</th><th className="p-4">Moyen</th><th className="p-4 text-right">Montant</th><th className="p-4 text-right">Vendeur</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {mergedList.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">Aucun résultat.</td></tr> : mergedList.map(item => (
                        <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${item.type === 'ANNULATION' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                            <td className="p-4 font-mono text-slate-500">{new Date(item.date).toLocaleTimeString()}</td>
                            <td className="p-4">
                                {item.type === 'ENCAISSEMENT' 
                                    ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit border border-emerald-100"><FiCheckCircle/> Encaissé</span> 
                                    : <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded w-fit border border-red-100"><FiTrash2/> Annulé</span>
                                }
                            </td>
                            <td className="p-4 font-bold text-indigo-600">{item.ticket && item.ticket !== "?" ? `#${item.ticket}` : "-"}</td> 
                            <td className="p-4 capitalize text-slate-600 dark:text-slate-300">{item.moyen !== 'indefini' ? item.moyen : <span className="text-slate-400 italic">N/A</span>}</td>
                            <td className={`p-4 text-right font-bold ${item.type === 'ANNULATION' ? 'text-red-500 line-through' : 'text-slate-800 dark:text-white'}`}>{item.montant} €</td>
                            <td className="p-4 text-right text-slate-500 text-xs">{item.vendeur}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- MODAL POP-UP VENDEUR --- */}
      {showVendeurModal && selectedVendeurEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div><h3 className="text-xl font-bold flex items-center gap-2"><FiUser /> {selectedVendeurEmail}</h3><p className="text-slate-400 text-sm mt-1">Détail des opérations (Inclus Suppressions)</p></div>
                    <button onClick={() => setShowVendeurModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><FiX className="text-xl"/></button>
                </div>
                
                {/* FILTRES MODAL */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-end">
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                        <select value={vendeurFilterMode} onChange={(e) => setVendeurFilterMode(e.target.value)} className="pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 dark:text-white cursor-pointer appearance-none">
                            <option value="TOUS">Tous Modes</option><option value="especes">Espèces</option><option value="cb">Carte</option><option value="cheque">Chèque</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0"><tr className="text-slate-500 uppercase text-xs"><th className="p-4">Heure</th><th className="p-4">Type</th><th className="p-4">Moyen</th><th className="p-4 text-right">Montant</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredModalTransactions.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-400">Aucune donnée trouvée.</td></tr> : filteredModalTransactions.map(t => (
                                <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${t.type === 'ANNULATION' ? 'bg-red-50/30' : ''}`}>
                                    <td className="p-4 font-mono text-slate-500">{new Date(t.date).toLocaleTimeString()}</td>
                                    <td className="p-4 font-bold text-xs uppercase">{t.type === 'ANNULATION' ? <span className="text-red-500">Annulation</span> : <span className="text-green-600">Encaissement</span>}</td>
                                    <td className="p-4 capitalize"><span className={`px-2 py-1 rounded text-xs font-bold ${t.moyen === 'especes' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{t.moyen}</span></td>
                                    <td className={`p-4 text-right font-bold ${t.type === 'ANNULATION' ? 'text-red-500 line-through' : 'text-slate-800 dark:text-white'}`}>{t.montant} €</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-500">Total Validé</span>
                    <div className="flex gap-4">
                        <span className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded">Esp: {vendeursStats[selectedVendeurEmail]?.especes.toFixed(2)} €</span>
                        <span className="text-slate-800 font-black text-lg ml-2">{vendeursStats[selectedVendeurEmail]?.total.toFixed(2)} €</span>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}