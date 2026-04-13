import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiCreditCard, FiDollarSign, FiCalendar, 
  FiInbox, FiLock, FiMonitor, FiPrinter, 
  FiDownload, FiDatabase, FiX, FiSearch 
} from "react-icons/fi";

export default function Compta() {
  // --- ÉTATS ---
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // États Modale
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDailyTransactions(selectedDate);
  }, [selectedDate]);

  const fetchDailyTransactions = async (dateStr) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const openHistoryModal = async () => {
    setIsHistoryModalOpen(true);
    if (allTransactions.length === 0) {
      try {
        setLoadingHistory(true);
        const { data, error } = await supabase
          .from('historique_paiements')
          .select('*')
          .order('date_paiement', { ascending: false });

        if (error) throw error;
        setAllTransactions(data || []);
      } catch (err) {
        console.error("❌ Erreur chargement historique complet :", err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  // --- FONCTION D'EXPORT INTELLIGENTE ---
  const handleExportExcel = (dataToExport, filename, isComplete = false) => {
    if (dataToExport.length === 0) return alert("Aucune donnée à exporter.");

    let headers = [];
    let rows = [];

    if (isComplete) {
      // 1. EXPORT COMPLET
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
      // 2. EXPORT JOURNÉE
      headers = ["Date", "Heure", "Moyen de Paiement", "Numero Ticket", "Montant Euros"];
      
      rows = dataToExport.map(tx => {
        const d = new Date(tx.date_paiement);
        const dateStr = d.toLocaleDateString('fr-FR');
        const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const moyen = tx.moyen_paiement || "Inconnu";
        // CORRECTION ICI : Utilisation de ticket_num
        const ref = tx.ticket_num || tx.commande_id || tx.id_commande || "Non lié";
        const montant = tx.montant_cents ? (Number(tx.montant_cents) / 100).toFixed(2).replace('.', ',') : "0,00";

        return [dateStr, heureStr, moyen, ref, montant]
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

  // --- CALCULS DES TOTAUX ---
  let totalStripe = 0, totalCB = 0, totalEspeces = 0;
  transactions.forEach(tx => {
    const montant = (Number(tx.montant_cents) || 0) / 100;
    if (tx.moyen_paiement === 'stripe') totalStripe += montant;
    else if (tx.moyen_paiement === 'cb') totalCB += montant;
    else if (tx.moyen_paiement === 'especes') totalEspeces += montant;
  });
  const totalGlobal = totalStripe + totalCB + totalEspeces;
  const totalCaissePhysique = totalCB + totalEspeces;

  const formatTime = (dateString, includeDate = false) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (includeDate) {
      return date.toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  };

  const getPaiementBadge = (moyen) => {
    switch (moyen?.toLowerCase()) {
      case 'stripe': return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiMonitor/> Stripe</span>;
      case 'cb': return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiCreditCard/> CB</span>;
      case 'especes': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiDollarSign/> Espèces</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{moyen || "Inconnu"}</span>;
    }
  };

  // CORRECTION ICI : Filtrage avec ticket_num
  const filteredHistory = allTransactions.filter(tx => {
    const searchStr = searchTerm.toLowerCase();
    return (
      tx.date_paiement?.toLowerCase().includes(searchStr) ||
      tx.moyen_paiement?.toLowerCase().includes(searchStr) ||
      String(tx.ticket_num || tx.commande_id || tx.id_commande).toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
              <FiLock className="text-2xl" />
            </div>
            Contrôle de Caisse
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Clôture journalière et vérification des paiements.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button 
            onClick={openHistoryModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all font-bold text-sm shadow-xl shadow-slate-800/20"
          >
            <FiDatabase /> Voir Historique Complet
          </button>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="pl-3 text-slate-400"><FiCalendar className="text-xl"/></div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-slate-700 dark:text-white font-bold cursor-pointer outline-none py-2 pr-4"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse text-slate-500 font-bold">Calcul en cours...</div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
              <p className="text-sm font-bold text-slate-400 uppercase">Total Journée</p>
              <h3 className="text-4xl font-black mt-2">{totalGlobal.toFixed(2)} €</h3>
              <p className="text-xs text-slate-500 mt-2">{transactions.length} transactions</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2 border-emerald-500">
              <p className="text-sm font-bold text-emerald-600 uppercase text-center">Caisse Physique (Espèces + CB)</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2 text-center">{totalCaissePhysique.toFixed(2)} €</h3>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-around">
                <div className="text-center">
                  <p className="text-xs text-slate-400 font-bold uppercase">Espèces</p>
                  <p className="font-black text-emerald-500 text-xl">{totalEspeces.toFixed(2)} €</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 font-bold uppercase">CB TPE</p>
                  <p className="font-black text-blue-500 text-xl">{totalCB.toFixed(2)} €</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 md:col-span-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase">Ventes Web (Stripe)</p>
                <h3 className="text-3xl font-black text-indigo-600 mt-2">{totalStripe.toFixed(2)} €</h3>
                <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1"><FiMonitor/> Automatique</p>
              </div>
              <FiCreditCard className="text-5xl text-slate-100 dark:text-slate-700"/>
            </div>
          </div>

          {/* TABLEAU JOURNALIER */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-black text-slate-800 dark:text-white text-lg">Transactions du {new Date(selectedDate).toLocaleDateString('fr-FR')}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExportExcel(transactions, `compta_jour_${selectedDate}`, false)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-sm"
                >
                  <FiDownload /> Export Excel
                </button>
                <button onClick={() => window.print()} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-500"><FiPrinter /></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                    <th className="p-4 text-xs font-black text-slate-400 uppercase">Heure</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase">Moyen</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase">N° Ticket</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {transactions.length === 0 ? (
                    <tr><td colSpan="4" className="p-12 text-center text-slate-400">Aucune vente ce jour.</td></tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-600 dark:text-slate-300">{formatTime(tx.date_paiement)}</td>
                        <td className="p-4">{getPaiementBadge(tx.moyen_paiement)}</td>
                        {/* CORRECTION ICI : tx.ticket_num */}
                        <td className="p-4 text-sm font-mono text-slate-400">#{tx.ticket_num || tx.commande_id || tx.id_commande || "N/A"}</td>
                        <td className="p-4 text-right font-black">{(Number(tx.montant_cents) / 100).toFixed(2)} €</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* --- MODALE --- */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-full max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
            
            <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center gap-3">
                  <FiDatabase className="text-emerald-500" /> Historique de toute la table
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
                  className="bg-transparent border-none focus:ring-0 text-slate-700 dark:text-white font-medium w-full"
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
              {loadingHistory ? (
                <div className="flex justify-center items-center h-full text-slate-500 font-bold">Chargement de la base de données...</div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
                    <tr>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Date & Heure</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">Paiement</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">N° Ticket</th>
                      <th className="p-5 text-xs font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredHistory.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-5 text-sm font-bold text-slate-600 dark:text-slate-300">{formatTime(tx.date_paiement, true)}</td>
                        <td className="p-5">{getPaiementBadge(tx.moyen_paiement)}</td>
                        {/* CORRECTION ICI : tx.ticket_num */}
                        <td className="p-5 text-sm font-mono text-slate-500">#{tx.ticket_num || tx.commande_id || tx.id_commande || "N/A"}</td>
                        <td className="p-5 text-right font-black text-slate-800 dark:text-white">{(Number(tx.montant_cents) / 100).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}