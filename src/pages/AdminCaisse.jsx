import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiCreditCard, FiDollarSign, FiCalendar, 
  FiLock, FiMonitor, FiPrinter, 
  FiDownload, FiDatabase, FiX, FiSearch,
  FiArrowUpRight, FiArrowDownRight, FiGlobe, FiPieChart
} from "react-icons/fi";

export default function Compta() {
  // --- ÉTATS ---
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // États Modale
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Au montage, on charge l'historique complet pour les stats globales
  useEffect(() => {
    fetchGlobalTransactions();
  }, []);

  // À chaque changement de date, on filtre pour la journée
  useEffect(() => {
    fetchDailyTransactions(selectedDate);
  }, [selectedDate]);

  const fetchGlobalTransactions = async () => {
    try {
      setLoadingGlobal(true);
      const { data, error } = await supabase
        .from('historique_paiements')
        .select('*')
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      setAllTransactions(data || []);
    } catch (err) {
      console.error("❌ Erreur chargement global :", err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const fetchDailyTransactions = async (dateStr) => {
    try {
      setLoadingDaily(true);
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('historique_paiements')
        .select('*')
        .gte('date_paiement', startOfDay.toISOString())
        .lte('date_paiement', endOfDay.toISOString())
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error("❌ Erreur de chargement jour :", err);
    } finally {
      setLoadingDaily(false);
    }
  };

  // --- FONCTION D'EXPORT ---
  const handleExportExcel = (dataToExport, filename, isComplete = false) => {
    if (dataToExport.length === 0) return alert("Aucune donnée à exporter.");

    let headers = [];
    let rows = [];

    if (isComplete) {
      headers = Object.keys(dataToExport[0]);
      rows = dataToExport.map(row => {
        return headers.map(header => {
          let val = row[header];
          if (val === null || val === undefined) val = "";
          if (header === 'montant_cents' && val !== "") {
            val = (Number(val) / 100).toFixed(2).replace('.', ',');
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(";");
      });
    } else {
      headers = ["Date", "Heure", "Moyen", "Type de Mouvement", "Numero Ticket", "Montant Euros"];
      rows = dataToExport.map(tx => {
        const d = new Date(tx.date_paiement);
        const dateStr = d.toLocaleDateString('fr-FR');
        const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const moyen = tx.moyen_paiement || "Inconnu";
        const montantReel = (Number(tx.montant_cents) || 0) / 100;
        const typeMouv = montantReel >= 0 ? "Entrée" : "Sortie";
        const ref = tx.ticket_num || tx.commande_id || tx.id_commande || "Mouvement Caisse";
        const montantFormat = montantReel.toFixed(2).replace('.', ',');

        return [dateStr, heureStr, moyen, typeMouv, ref, montantFormat]
          .map(val => `"${String(val).replace(/"/g, '""')}"`)
          .join(";");
      });
    }

    const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALCULS DES TOTAUX GLOBAUX ---
  let globalStripe = 0, globalCB = 0, globalEspeces = 0;
  let globalEntrees = 0, globalSorties = 0;

  allTransactions.forEach(tx => {
    const montant = (Number(tx.montant_cents) || 0) / 100;
    if (montant >= 0) globalEntrees += montant;
    else globalSorties += montant;

    if (tx.moyen_paiement === 'stripe') globalStripe += montant;
    else if (tx.moyen_paiement === 'cb') globalCB += montant;
    else if (tx.moyen_paiement === 'especes' || tx.moyen_paiement === 'retrait' || tx.moyen_paiement === 'ajout') {
      globalEspeces += montant;
    }
  });

  const globalTotalNet = globalEntrees + globalSorties; 
  const globalCaissePhysique = globalCB + globalEspeces;

  // --- CALCULS DES TOTAUX JOURNALIERS ---
  let dailyStripe = 0, dailyCB = 0, dailyEspeces = 0;
  let dailyEntrees = 0, dailySorties = 0;

  transactions.forEach(tx => {
    const montant = (Number(tx.montant_cents) || 0) / 100;
    if (montant >= 0) dailyEntrees += montant;
    else dailySorties += montant;

    if (tx.moyen_paiement === 'stripe') dailyStripe += montant;
    else if (tx.moyen_paiement === 'cb') dailyCB += montant;
    else if (tx.moyen_paiement === 'especes' || tx.moyen_paiement === 'retrait' || tx.moyen_paiement === 'ajout') {
      dailyEspeces += montant;
    }
  });

  const dailyTotalNet = dailyEntrees + dailySorties;
  const dailyCaissePhysique = dailyCB + dailyEspeces;

  // --- HELPERS UI ---
  const formatTime = (dateString, includeDate = false) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (includeDate) {
      return date.toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  };

  const getPaiementBadge = (moyen, montant) => {
    const isRetrait = montant < 0 || moyen === 'retrait';
    if (isRetrait && moyen === 'especes') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiArrowDownRight/> Retrait Espèces</span>;
    }
    switch (moyen?.toLowerCase()) {
      case 'stripe': return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiMonitor/> Stripe</span>;
      case 'cb': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiCreditCard/> CB</span>;
      case 'especes': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiDollarSign/> Espèces</span>;
      case 'ajout': return <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiArrowUpRight/> Ajout Caisse</span>;
      case 'retrait': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiArrowDownRight/> Retrait</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{moyen || "Inconnu"}</span>;
    }
  };

  const filteredHistory = allTransactions.filter(tx => {
    const searchStr = searchTerm.toLowerCase();
    return (
      tx.date_paiement?.toLowerCase().includes(searchStr) ||
      tx.moyen_paiement?.toLowerCase().includes(searchStr) ||
      String(tx.ticket_num || tx.commande_id || tx.id_commande).toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in relative">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
              <FiLock className="text-2xl" />
            </div>
            Tableau de Bord Comptable
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Analyse globale et clôtures journalières.</p>
        </div>
        <button 
          onClick={() => setIsHistoryModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all font-bold text-sm shadow-xl shadow-slate-800/20"
        >
          <FiDatabase /> Consulter l'historique complet
        </button>
      </div>

      {/* --- RAPPORT GLOBAL --- */}
      <div className="space-y-6">
        <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <FiGlobe className="text-blue-500" /> 
          Rapport Global <span className="text-sm text-slate-400 font-medium ml-2">(Toutes dates confondues)</span>
        </h3>
        
        {loadingGlobal ? (
          <div className="h-32 flex items-center justify-center text-slate-500 font-bold animate-pulse">Chargement des statistiques globales...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Global 1: TOTAL NET */}
            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
              <div className="z-10">
                <p className="text-xs font-bold text-blue-400 uppercase">Solde Net Global</p>
                <h3 className="text-4xl font-black mt-2">{globalTotalNet.toFixed(2)} €</h3>
              </div>
              <p className="text-xs text-slate-400 mt-4 font-medium z-10">{allTransactions.length} transactions au total</p>
              <FiPieChart className="absolute -right-4 -bottom-4 text-8xl text-white/5 z-0" />
            </div>

            {/* Global 2: CAISSE PHYSIQUE */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase text-center">Caisse Physique Globale</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2 text-center">{globalCaissePhysique.toFixed(2)} €</h3>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-around">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Espèces Net</p>
                  <p className="font-black text-emerald-500 text-lg">{globalEspeces.toFixed(2)} €</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">CB TPE</p>
                  <p className="font-black text-blue-500 text-lg">{globalCB.toFixed(2)} €</p>
                </div>
              </div>
            </div>

            {/* Global 3: FLUX */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-500 uppercase text-center">Flux Historique</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl">
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><FiArrowUpRight/> Total Entrées</span>
                  <span className="font-black text-emerald-600">+{globalEntrees.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl">
                  <span className="text-xs font-bold text-red-600 flex items-center gap-1"><FiArrowDownRight/> Total Sorties</span>
                  <span className="font-black text-red-600">{globalSorties.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Global 4: WEB */}
            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-3xl shadow-sm border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-500 uppercase">Total Ventes Web (Stripe)</p>
                <h3 className="text-3xl font-black text-indigo-700 dark:text-indigo-400 mt-2">{globalStripe.toFixed(2)} €</h3>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-400">
                <FiMonitor className="text-base"/> Paiements en ligne
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-2 border-dashed border-slate-200 dark:border-slate-700" />

      {/* --- RAPPORT JOURNALIER --- */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <FiCalendar className="text-emerald-500" /> 
            Comptabilité Journalière
          </h3>
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
            <span className="text-sm font-bold text-slate-500">Choisir une date :</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white font-black cursor-pointer outline-none"
            />
          </div>
        </div>

        {loadingDaily ? (
          <div className="h-32 flex flex-col items-center justify-center animate-pulse text-slate-500 font-bold">Calcul de la journée en cours...</div>
        ) : (
          <>
            {/* STATS DU JOUR */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-6 rounded-3xl shadow-lg text-white flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Solde Net du Jour</p>
                  <h3 className="text-4xl font-black mt-2 text-emerald-400">{dailyTotalNet.toFixed(2)} €</h3>
                </div>
                <p className="text-xs text-slate-400 mt-4 font-medium">{transactions.length} mouvements aujourd'hui</p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2 border-emerald-500 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase text-center">Caisse Physique Jour</p>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2 text-center">{dailyCaissePhysique.toFixed(2)} €</h3>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-around">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Espèces Net</p>
                    <p className="font-black text-emerald-500 text-lg">{dailyEspeces.toFixed(2)} €</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">CB TPE</p>
                    <p className="font-black text-blue-500 text-lg">{dailyCB.toFixed(2)} €</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-400 uppercase text-center">Flux du Jour</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><FiArrowUpRight/> Entrées</span>
                    <span className="font-black text-emerald-600">+{dailyEntrees.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 px-3 py-2.5 rounded-xl">
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1"><FiArrowDownRight/> Sorties</span>
                    <span className="font-black text-red-600">{dailySorties.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Ventes Web Jour</p>
                  <h3 className="text-3xl font-black text-indigo-600 mt-2">{dailyStripe.toFixed(2)} €</h3>
                </div>
              </div>
            </div>

            {/* TABLEAU JOURNALIER */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-black text-slate-800 dark:text-white text-lg">Mouvements du {new Date(selectedDate).toLocaleDateString('fr-FR')}</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExportExcel(transactions, `compta_jour_${selectedDate}`, false)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-sm transition-all hover:scale-105"
                  >
                    <FiDownload /> Exporter la journée
                  </button>
                  <button onClick={() => window.print()} className="p-2 bg-white dark:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shadow-sm"><FiPrinter /></button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Heure</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Mouvement</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase">Référence</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {transactions.length === 0 ? (
                      <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium bg-slate-50/30 dark:bg-transparent">Aucun mouvement enregistré ce jour.</td></tr>
                    ) : (
                      transactions.map((tx) => {
                        const montant = Number(tx.montant_cents) / 100;
                        const isNegative = montant < 0;

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-bold text-slate-600 dark:text-slate-300">{formatTime(tx.date_paiement)}</td>
                            <td className="p-4">{getPaiementBadge(tx.moyen_paiement, montant)}</td>
                            <td className="p-4 text-sm font-mono text-slate-400">
                              {tx.ticket_num ? `#${tx.ticket_num}` : "Opération Caisse"}
                            </td>
                            <td className={`p-4 text-right font-black ${isNegative ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                              {isNegative ? '' : '+'}{montant.toFixed(2)} €
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- MODALE HISTORIQUE COMPLET --- */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-full max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
            
            <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center gap-3">
                  <FiDatabase className="text-emerald-500" /> Base de Données Comptable Globale
                </h3>
                <p className="text-slate-500 font-medium mt-1">Exportation exhaustive de la base de données</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:rotate-90 transition-all">
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800">
              <div className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <FiSearch className="text-slate-400 text-lg"/>
                <input 
                  type="text" 
                  placeholder="Rechercher par date, N° de ticket ou paiement..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-slate-700 dark:text-white font-medium w-full outline-none"
                />
              </div>
              <button 
                onClick={() => handleExportExcel(allTransactions, "export_compta_complet_DB", true)}
                className="flex justify-center items-center gap-3 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all font-bold shadow-lg shadow-emerald-600/20"
              >
                <FiDownload className="text-lg"/> EXPORTER TOUTE LA TABLE
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
                  <tr>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Date & Heure</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Mouvement</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Référence</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredHistory.map((tx) => {
                    const montant = Number(tx.montant_cents) / 100;
                    const isNegative = montant < 0;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="p-5 text-sm font-bold text-slate-600 dark:text-slate-300">{formatTime(tx.date_paiement, true)}</td>
                        <td className="p-5">{getPaiementBadge(tx.moyen_paiement, montant)}</td>
                        <td className="p-5 text-sm font-mono text-slate-500">
                          {tx.ticket_num ? `#${tx.ticket_num}` : "Opération Caisse"}
                        </td>
                        <td className={`p-5 text-right font-black ${isNegative ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                          {isNegative ? '' : '+'}{montant.toFixed(2)} €
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