import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiCalendar, FiDollarSign, FiCreditCard, FiFileText, FiActivity, 
  FiAlertTriangle, FiPrinter, FiRefreshCw, FiUser, FiUsers, FiX, FiList, FiFilter, FiTrash2, FiCheckCircle, FiArrowRight, FiClipboard, FiEdit3, FiCheck 
} from "react-icons/fi";

export default function AdminCaisse() {
  const [loading, setLoading] = useState(true);
  
  // Dates
  const getTodayLocal = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };
  const [dateDebut, setDateDebut] = useState(getTodayLocal());
  const [dateFin, setDateFin] = useState(getTodayLocal());

  // Data
  const [mergedList, setMergedList] = useState([]);
  const [totaux, setTotaux] = useState({ especes: 0, cb: 0, cheque: 0, total: 0 });
  const [vendeursStats, setVendeursStats] = useState({});

  // Filtres Tableau
  const [filterMode, setFilterMode] = useState("TOUS"); 
  const [filterAction, setFilterAction] = useState("TOUS"); 

  // --- MODAL DÉTAILS TRANSACTIONS (Consultation simple) ---
  const [selectedVendeurDetails, setSelectedVendeurDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // --- SYSTÈME DE COMPTAGE (Z DE CAISSE) ---
  const [showComptageModal, setShowComptageModal] = useState(false);
  const [stepComptage, setStepComptage] = useState(1); // 1: Choix Vendeur, 2: Saisie, 3: Résultat
  const [vendeurToCount, setVendeurToCount] = useState(null); // L'email du vendeur sélectionné
  const [saisie, setSaisie] = useState({ especes: "", cb: "", cheque: "" }); 

  // Fetch Data
  useEffect(() => {
    fetchData();
    const sub = supabase.channel('caisse_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paiements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caisse_logs' }, () => fetchData()) 
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [dateDebut, dateFin]);

  async function fetchData() {
    setLoading(true);
    const start = new Date(dateDebut); start.setHours(0, 0, 0, 0);
    const end = new Date(dateFin); end.setHours(23, 59, 59, 999);

    try {
      // -----------------------------------------------------------------------
      // 1. PAIEMENTS (Méthode Robuste : Sans jointure qui bloque)
      // -----------------------------------------------------------------------
      let paiementsData = [];
      
      // On demande juste la table brute, ça ne peut pas échouer
      const { data: dataSimple, error: errSimple } = await supabase
        .from("paiements")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (!errSimple && dataSimple) {
          paiementsData = dataSimple;

          // Récupération manuelle des numéros de ticket pour éviter les erreurs de jointure
          const commandeIds = [...new Set(paiementsData.map(p => p.commande_id).filter(id => id))];
          
          if (commandeIds.length > 0) {
              const { data: ticketsData } = await supabase
                  .from("commandes")
                  .select("id, ticket_num")
                  .in("id", commandeIds);
              
              const ticketMap = {};
              ticketsData?.forEach(t => { ticketMap[t.id] = t.ticket_num; });

              // On injecte le ticket dans chaque paiement
              paiementsData = paiementsData.map(p => ({
                  ...p,
                  ticket_retrieved: ticketMap[p.commande_id] 
              }));
          }
      }

      // -----------------------------------------------------------------------
      // 2. ANNULATIONS (Méthode Robuste déjà en place)
      // -----------------------------------------------------------------------
      let logsData = [];
      const { data: logsSimple, error: errLogs } = await supabase
        .from("caisse_logs")
        .select("*") 
        .eq("action", "ANNULATION")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (!errLogs && logsSimple) {
          logsData = logsSimple;
          const commandeIdsLogs = [...new Set(logsData.map(l => l.commande_id).filter(id => id))];
          if (commandeIdsLogs.length > 0) {
              const { data: ticketsDataLogs } = await supabase.from("commandes").select("id, ticket_num").in("id", commandeIdsLogs);
              const ticketMapLogs = {};
              ticketsDataLogs?.forEach(t => { ticketMapLogs[t.id] = t.ticket_num; });
              logsData = logsData.map(log => ({ ...log, ticket_retrieved: ticketMapLogs[log.commande_id] }));
          }
      }

      // 3. Calculs et Fusion
      const statsGlobales = { especes: 0, cb: 0, cheque: 0, total: 0 };
      const statsParVendeur = {};
      let list = [];

      // A. Traitement des Encaissements
      paiementsData.forEach(p => {
        const m = parseFloat(p.montant);
        // On utilise vendeur_trace (texte brut) qui est fiable
        const vEmail = p.vendeur_trace || "Inconnu";

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

        list.push({
            id: p.id, 
            type: 'ENCAISSEMENT', 
            date: p.created_at, 
            montant: p.montant, 
            moyen: p.moyen,
            // Priorité au ticket récupéré manuellement
            ticket: p.ticket_retrieved || "?", 
            vendeur: vEmail
        });
      });

      // B. Traitement des Annulations
      logsData.forEach(l => {
          const m = parseFloat(l.montant || 0);
          const vEmail = l.user_email || "Système"; 
          
          if (!statsParVendeur[vEmail]) statsParVendeur[vEmail] = { especes: 0, cb: 0, cheque: 0, total: 0, count: 0, annul_count: 0, annul_total: 0 };
          statsParVendeur[vEmail].annul_count += 1;
          statsParVendeur[vEmail].annul_total += m;

          let detectedMoyen = 'indefini';
          const det = (l.details || "").toLowerCase();
          if (det.includes('especes') || det.includes('espèces')) detectedMoyen = 'especes';
          else if (det.includes('cb') || det.includes('carte')) detectedMoyen = 'cb';
          else if (det.includes('cheque') || det.includes('chèque')) detectedMoyen = 'cheque';

          list.push({
              id: l.id, 
              type: 'ANNULATION', 
              date: l.created_at, 
              montant: l.montant || 0, 
              moyen: detectedMoyen,
              ticket: l.ticket_retrieved || '?', 
              vendeur: vEmail, 
              details: l.details
          });
      });

      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setMergedList(list);
      setTotaux(statsGlobales);
      setVendeursStats(statsParVendeur);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  // --- LOGIQUE DU COMPTAGE ---
  const startComptage = () => {
      setStepComptage(1);
      setVendeurToCount(null);
      setSaisie({ especes: "", cb: "", cheque: "" });
      setShowComptageModal(true);
  };

  const selectVendeurForComptage = (email) => {
      setVendeurToCount(email);
      setStepComptage(2); // Passage à la saisie
  };

  const validateSaisie = () => {
      setStepComptage(3); // Passage au résultat
  };

  const handlePrintZ = () => window.print();

  // Filtrage liste principale
  const filteredList = mergedList.filter(item => {
      const matchAction = filterAction === "TOUS" || item.type === filterAction;
      let matchMode = true;
      if (filterMode !== "TOUS") {
          if (item.type === 'ANNULATION') matchMode = true;
          else if (filterMode === 'cb') matchMode = item.moyen === 'cb' || item.moyen === 'stripe_online';
          else matchMode = item.moyen === filterMode;
      }
      return matchAction && matchMode;
  });

  return (
    <div className="space-y-8 p-4 md:p-8 animate-fade-in max-w-7xl mx-auto pb-20">
      
      {/* HEADER + BOUTONS ACTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 print:hidden">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white shadow-xl shadow-indigo-500/30">
                <FiDollarSign className="text-3xl" />
            </div>
            Comptabilité
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-lg">Bilan journalier et clôture de caisse.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none w-full xl:w-auto">
            <div className="flex items-center gap-3 px-3 py-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <FiCalendar className="text-indigo-500" />
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none w-32 cursor-pointer text-sm" />
                <FiArrowRight className="text-slate-300" />
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none w-32 cursor-pointer text-sm" />
            </div>

            <button onClick={() => {const t = getTodayLocal(); setDateDebut(t); setDateFin(t);}} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-xl text-sm font-bold transition-all">Aujourd'hui</button>
            <button onClick={fetchData} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-colors"><FiRefreshCw className={loading ? 'animate-spin' : ''}/></button>
            
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

            {/* BOUTON PRINCIPAL : COMPTAGE */}
            <button 
                onClick={startComptage} 
                className="ml-auto md:ml-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-xl text-sm font-bold shadow-xl shadow-slate-900/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
                <FiClipboard className="text-lg" /> Faire la Caisse (Z)
            </button>
        </div>
      </div>

      {/* TOTAUX GLOBAUX */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
        <div className="md:col-span-2 xl:col-span-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/10 transition-all"></div>
            <div className="relative z-10">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Chiffre d'Affaires Total (Validé)</p>
                <p className="text-5xl font-black mt-2 tracking-tight">{totaux.total.toFixed(2)} €</p>
            </div>
            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm shadow-inner relative z-10"><FiActivity /></div>
        </div>
        
        {/* Cartes détails */}
        {[
          { label: "Espèces", amount: totaux.especes, icon: <FiDollarSign/>, color: "green" },
          { label: "Carte Bancaire", amount: totaux.cb, icon: <FiCreditCard/>, color: "blue" },
          { label: "Chèques", amount: totaux.cheque, icon: <FiFileText/>, color: "orange" }
        ].map((card, idx) => (
            <div key={idx} className={`bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border-2 border-transparent hover:border-${card.color}-100 dark:hover:border-${card.color}-900/30 transition-all group`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                        <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{card.amount.toFixed(2)} €</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-600 dark:bg-${card.color}-900/20 dark:text-${card.color}-400 text-xl group-hover:scale-110 transition-transform`}>
                        {card.icon}
                    </div>
                </div>
            </div>
        ))}
      </div>

      <div className="print:hidden h-px bg-slate-200 dark:bg-slate-700 my-4"></div>

      {/* LISTE DES VENDEURS */}
      <div className="print:hidden">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><FiUsers /></span> 
            Activité par Vendeur
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(vendeursStats).length === 0 ? (
                <div className="col-span-3 py-12 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-center">
                    <p className="text-slate-400 font-medium">Aucune activité enregistrée sur cette période.</p>
                </div>
            ) : Object.entries(vendeursStats).map(([email, stats]) => (
                <div key={email} className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="p-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center w-full">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/30">
                                {email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">{email.split('@')[0]}</p>
                                <p className="text-xs text-slate-500 font-medium">{stats.count} actes</p>
                            </div>
                        </div>
                        <span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-sm shadow-lg">{stats.total.toFixed(2)} €</span>
                    </div>
                    
                    <div className="p-5 space-y-3 flex-1">
                        <div className="flex justify-between text-sm items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <span className="text-slate-500 flex items-center gap-2"><FiDollarSign className="text-green-500"/> Espèces</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{stats.especes.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between text-sm items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <span className="text-slate-500 flex items-center gap-2"><FiCreditCard className="text-blue-500"/> Carte</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{stats.cb.toFixed(2)} €</span>
                        </div>
                        
                        {stats.annul_count > 0 && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex justify-between items-center text-xs text-red-600 font-medium animate-pulse">
                                <span className="flex items-center gap-1.5 font-bold"><FiAlertTriangle/> {stats.annul_count} Annulations</span>
                                <span className="font-bold">- {stats.annul_total.toFixed(2)} €</span>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-700">
                        <button onClick={() => { setSelectedVendeurDetails(email); setShowDetailsModal(true); }} className="py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                            <FiList /> Historique
                        </button>
                        <button onClick={() => { setVendeurToCount(email); setSaisie({especes:"", cb:"", cheque:""}); setStepComptage(2); setShowComptageModal(true); }} className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                            <FiEdit3 /> Faire la Caisse
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* JOURNAL DES MOUVEMENTS */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden mt-8 print:hidden">
          <div className="p-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><FiList className="text-indigo-500"/> Journal Global</h3>
            <div className="flex gap-2">
                <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm font-bold p-2 outline-none"><option value="TOUS">Tout</option><option value="ENCAISSEMENT">Encaissements</option><option value="ANNULATION">Annulations</option></select>
                <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm font-bold p-2 outline-none"><option value="TOUS">Tous Modes</option><option value="especes">Espèces</option><option value="cb">Carte</option></select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-sm z-10">
                    <tr className="text-slate-400 uppercase text-xs">
                        <th className="p-4 font-bold">Heure</th>
                        <th className="p-4 font-bold">Action</th>
                        <th className="p-4 font-bold">Ticket</th>
                        <th className="p-4 font-bold">Moyen</th>
                        <th className="p-4 font-bold text-right">Montant</th>
                        <th className="p-4 font-bold text-right">Vendeur</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredList.map(item => (
                        <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${item.type === 'ANNULATION' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                            <td className="p-4 font-mono text-slate-500">{new Date(item.date).toLocaleTimeString()}</td>
                            <td className="p-4">
                                {item.type === 'ENCAISSEMENT' 
                                    ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100"><FiCheck/> Payé</span> 
                                    : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold border border-red-100"><FiTrash2/> Annulé</span>}
                            </td>
                            <td className="p-4 font-bold text-indigo-600 font-mono">#{item.ticket}</td>
                            <td className="p-4 capitalize text-slate-700 dark:text-slate-300">{item.moyen}</td>
                            <td className={`p-4 text-right font-bold ${item.type === 'ANNULATION' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{item.montant} €</td>
                            <td className="p-4 text-right text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-l-lg">{item.vendeur.split('@')[0]}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      </div>


      {/* --- MODAL DE COMPTAGE (STEP WIZARD) --- */}
      {showComptageModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 print:bg-white print:p-0 print:block">
              <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none flex flex-col max-h-[90vh]">
                  
                  {/* HEADER MODAL */}
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center print:hidden shrink-0">
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2"><FiClipboard /> Clôture de Caisse</h2>
                        {stepComptage > 1 && <p className="text-xs text-slate-400 mt-1">Étape {stepComptage} sur 3</p>}
                      </div>
                      <button onClick={() => setShowComptageModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><FiX className="text-lg"/></button>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 print:hidden shrink-0">
                      <div className={`h-full bg-indigo-500 transition-all duration-500 ease-out`} style={{width: `${(stepComptage/3)*100}%`}}></div>
                  </div>

                  {/* CORPS DE LA MODAL (SCROLLABLE) */}
                  <div className="overflow-y-auto flex-1 p-0">
                    
                    {/* ETAPE 1 : CHOIX VENDEUR */}
                    {stepComptage === 1 && (
                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Qui contrôlez-vous ?</h3>
                                <p className="text-slate-500">Sélectionnez le caissier pour commencer le comptage.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.keys(vendeursStats).length === 0 ? <p className="col-span-2 text-center italic text-slate-400 py-8">Aucun vendeur actif.</p> : Object.keys(vendeursStats).map(email => (
                                    <button key={email} onClick={() => selectVendeurForComptage(email)} className="flex flex-col items-center p-6 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-2 border-transparent hover:border-indigo-500 rounded-2xl transition-all group">
                                        <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <span className="text-2xl font-bold text-indigo-600">{email.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <span className="font-bold text-slate-700 dark:text-white">{email.split('@')[0]}</span>
                                        <span className="text-xs text-slate-400 mt-1">{vendeursStats[email].count} ventes</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPE 2 : SAISIE DES MONTANTS */}
                    {stepComptage === 2 && vendeurToCount && (
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => setStepComptage(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><FiArrowRight className="rotate-180"/></button>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Saisie Caisse</h3>
                                    <p className="text-sm text-slate-500">Vendeur : <span className="font-bold text-indigo-600">{vendeurToCount}</span></p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {['especes', 'cb', 'cheque'].map(type => (
                                    <div key={type} className="group">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Total {type === 'cb' ? 'Cartes' : type}</label>
                                        <div className="relative flex items-center">
                                            <div className="absolute left-4 text-slate-400 text-xl group-focus-within:text-indigo-500">
                                                {type === 'especes' ? <FiDollarSign/> : type === 'cb' ? <FiCreditCard/> : <FiFileText/>}
                                            </div>
                                            <input 
                                                type="number" step="0.01" placeholder="0.00"
                                                value={saisie[type]}
                                                onChange={(e) => setSaisie({...saisie, [type]: e.target.value})}
                                                className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 focus:border-indigo-500 rounded-2xl font-bold text-2xl outline-none text-slate-800 dark:text-white transition-all text-right"
                                            />
                                            <span className="absolute right-6 text-slate-400 font-bold">€</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPE 3 : RÉSULTAT (DESIGN TICKET) */}
                    {stepComptage === 3 && vendeurToCount && (
                        <div className="p-8 print:p-0 flex flex-col items-center">
                            
                            {/* TICKET DE CAISSE VISUEL */}
                            <div className="bg-white text-slate-900 w-full max-w-sm border border-slate-200 shadow-2xl print:shadow-none print:border-none print:w-full print:max-w-none relative">
                                
                                {/* Dents du ticket (Visuel) */}
                                <div className="absolute -bottom-2 left-0 w-full h-4 bg-transparent bg-[radial-gradient(circle,transparent_50%,white_50%)] bg-[length:20px_20px] rotate-180 print:hidden"></div>

                                <div className="p-8 space-y-6">
                                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                                        <h2 className="text-2xl font-black uppercase tracking-widest">CLÔTURE (Z)</h2>
                                        <p className="font-mono text-sm mt-1">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                                        <p className="font-mono font-bold mt-2 text-lg">{vendeurToCount}</p>
                                    </div>

                                    <div className="space-y-3 font-mono text-sm">
                                        {['especes', 'cb', 'cheque'].map(type => {
                                            const theorique = vendeursStats[vendeurToCount]?.[type] || 0;
                                            const reel = parseFloat(saisie[type] || 0);
                                            const diff = reel - theorique;
                                            const isError = Math.abs(diff) > 0.05;

                                            return (
                                                <div key={type} className="flex flex-col border-b border-dashed border-slate-300 pb-2">
                                                    <div className="flex justify-between font-bold uppercase">
                                                        <span>{type}</span>
                                                        <span>{reel.toFixed(2)} €</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500 print:hidden">
                                                        <span>Théorique:</span>
                                                        <span>{theorique.toFixed(2)} €</span>
                                                    </div>
                                                    {isError ? (
                                                        <div className="flex justify-between text-xs font-bold text-red-600 mt-1 print:text-black">
                                                            <span>ÉCART !!</span>
                                                            <span>{diff > 0 ? '+' : ''}{diff.toFixed(2)} €</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-[10px] text-slate-400 mt-1 print:hidden">OK - RAS</div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="pt-2 flex justify-between items-center font-black text-xl border-t-2 border-black">
                                        <span>TOTAL</span>
                                        <span>
                                            {(parseFloat(saisie.especes||0) + parseFloat(saisie.cb||0) + parseFloat(saisie.cheque||0)).toFixed(2)} €
                                        </span>
                                    </div>
                                    
                                    <div className="mt-8 pt-8 border-t border-black hidden print:flex justify-between gap-8">
                                        <div className="flex-1 text-center">
                                            <p className="text-xs font-bold mb-8">SIGNATURE VENDEUR</p>
                                            <div className="border-b border-black"></div>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <p className="text-xs font-bold mb-8">SIGNATURE RESPONSABLE</p>
                                            <div className="border-b border-black"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                  
                  </div>

                  {/* FOOTER MODAL (BOUTONS) */}
                  <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 print:hidden shrink-0">
                        {stepComptage === 2 && (
                             <button onClick={validateSaisie} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2">
                                Valider et Voir le Résultat <FiArrowRight/>
                             </button>
                        )}
                        {stepComptage === 3 && (
                            <div className="flex gap-3">
                                <button onClick={() => setStepComptage(2)} className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white font-bold rounded-xl">Corriger</button>
                                <button onClick={handlePrintZ} className="flex-[2] py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2">
                                    <FiPrinter/> Imprimer Ticket (Z)
                                </button>
                            </div>
                        )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL HISTORIQUE SIMPLE --- */}
      {showDetailsModal && selectedVendeurDetails && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b flex justify-between items-center">
                    <h3 className="font-bold">Historique : {selectedVendeurDetails}</h3>
                    <button onClick={() => setShowDetailsModal(false)}><FiX/></button>
                </div>
                <div className="overflow-y-auto p-0">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0"><tr className="text-xs text-slate-500 uppercase"><th className="p-3">Heure</th><th className="p-3">Type</th><th className="p-3">Moyen</th><th className="p-3 text-right">Montant</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {mergedList.filter(i => i.vendeur === selectedVendeurDetails).map(t => (
                                <tr key={t.id} className={t.type === 'ANNULATION' ? 'bg-red-50 text-red-600' : ''}>
                                    <td className="p-3 font-mono">{new Date(t.date).toLocaleTimeString()}</td>
                                    <td className="p-3 font-bold text-xs">{t.type}</td>
                                    <td className="p-3 capitalize">{t.moyen}</td>
                                    <td className="p-3 text-right font-bold">{t.montant} €</td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}