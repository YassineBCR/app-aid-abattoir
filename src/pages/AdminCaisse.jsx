import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiFileText, FiCreditCard, FiDollarSign, FiCalendar, 
  FiInbox, FiLock, FiMonitor, FiPrinter
} from "react-icons/fi";

export default function Compta() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date sélectionnée (par défaut : aujourd'hui, format YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchTransactions(selectedDate);
  }, [selectedDate]);

  const fetchTransactions = async (dateStr) => {
    try {
      setLoading(true);

      // Création des limites de temps pour la journée sélectionnée (de 00:00 à 23:59)
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('historique_paiements')
        .select('*')
        // CORRECTION ICI : On utilise date_paiement au lieu de created_at
        .gte('date_paiement', startOfDay.toISOString())
        .lte('date_paiement', endOfDay.toISOString())
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);

    } catch (err) {
      console.error("❌ Erreur de chargement de la compta :", err);
    } finally {
      setLoading(false);
    }
  };

  // --- CALCUL DES TOTAUX DU JOUR ---
  let totalStripe = 0;
  let totalCB = 0;
  let totalEspeces = 0;

  transactions.forEach(tx => {
    const montant = (Number(tx.montant_cents) || 0) / 100;
    if (tx.moyen_paiement === 'stripe') totalStripe += montant;
    else if (tx.moyen_paiement === 'cb') totalCB += montant;
    else if (tx.moyen_paiement === 'especes') totalEspeces += montant;
  });

  const totalGlobal = totalStripe + totalCB + totalEspeces;
  const totalCaissePhysique = totalCB + totalEspeces; // Ce que le vendeur doit avoir dans sa caisse/TPE

  // Formatage de l'heure
  const formatTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
  };

  const getPaiementBadge = (moyen) => {
    switch (moyen?.toLowerCase()) {
      case 'stripe':
        return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiMonitor/> Stripe (Web)</span>;
      case 'cb':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiCreditCard/> CB Guichet</span>;
      case 'especes':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiDollarSign/> Espèces</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{moyen || "Inconnu"}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      {/* HEADER & FILTRE DE DATE */}
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <p className="text-slate-500 font-bold">Calcul de la caisse en cours...</p>
        </div>
      ) : (
        <>
          {/* KPIs - RÉSUMÉ DE CAISSE */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Total Global */}
            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
              <p className="text-sm font-bold text-slate-400 uppercase">Total Encaissé (Jour)</p>
              <h3 className="text-4xl font-black mt-2">{totalGlobal.toFixed(2)} €</h3>
              <p className="text-xs text-slate-500 mt-2">{transactions.length} transactions</p>
            </div>

            {/* Caisse Physique (Vendeur) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border-2 border-emerald-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><FiLock className="text-6xl text-emerald-500"/></div>
              <p className="text-sm font-bold text-emerald-600 uppercase">Caisse Physique (À vérifier)</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-2">{totalCaissePhysique.toFixed(2)} €</h3>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold">Espèces</p>
                  <p className="font-black text-emerald-500">{totalEspeces.toFixed(2)} €</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-bold">CB (TPE)</p>
                  <p className="font-black text-blue-500">{totalCB.toFixed(2)} €</p>
                </div>
              </div>
            </div>

            {/* Caisse Web (Stripe) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 md:col-span-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase">Paiements Web Automatiques</p>
                <h3 className="text-3xl font-black text-indigo-600 mt-2">{totalStripe.toFixed(2)} €</h3>
                <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1"><FiMonitor/> Géré via Stripe</p>
              </div>
              <div className="hidden sm:block p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
                 <FiCreditCard className="text-4xl text-indigo-400"/>
              </div>
            </div>

          </div>

          {/* TABLEAU DETAILLÉ DU JOUR */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-black text-slate-800 dark:text-white text-lg">Détail des transactions du {new Date(selectedDate).toLocaleDateString('fr-FR')}</h3>
              <button onClick={() => window.print()} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 transition-colors hidden md:block" title="Imprimer le rapport">
                <FiPrinter />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                  <FiInbox className="text-3xl text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold">Aucune transaction pour cette date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Heure</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Moyen de paiement</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Réf. Commande</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 whitespace-nowrap text-sm font-bold text-slate-600 dark:text-slate-300">
                          {/* CORRECTION ICI : tx.date_paiement au lieu de tx.created_at */}
                          {formatTime(tx.date_paiement)}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {getPaiementBadge(tx.moyen_paiement)}
                        </td>
                        <td className="p-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                          #{tx.commande_id || tx.id_commande || "Non lié"}
                        </td>
                        <td className="p-4 whitespace-nowrap text-right">
                          <span className="text-lg font-black text-slate-800 dark:text-white">
                            {tx.montant_cents ? (Number(tx.montant_cents) / 100).toFixed(2) : "0.00"} €
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}