import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiDollarSign, FiCreditCard, FiFileText, FiDownload, FiUser, 
  FiCalendar, FiSmartphone, FiArchive, FiAlertTriangle, FiCheckCircle, 
  FiClock, FiTrash2, FiList, FiUnlock
} from "react-icons/fi";

export default function AdminCaisse() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [sessionsCaisse, setSessionsCaisse] = useState([]);
  
  // Filtres
  const [dateFilter, setDateFilter] = useState("today"); // 'today', 'month', 'all', 'custom'
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("transactions"); 

  const [totaux, setTotaux] = useState({ stripe: 0, especes: 0, cb: 0, annulations: 0, totalNet: 0 });

  useEffect(() => {
    fetchData();
    
    const subTx = supabase.channel('realtime_tx')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historique_paiements' }, () => fetchData())
      .subscribe();
      
    const subCaisse = supabase.channel('realtime_caisses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caisses_vendeurs' }, () => fetchData())
      .subscribe();
      
    return () => { 
      supabase.removeChannel(subTx);
      supabase.removeChannel(subCaisse);
    };
  }, [dateFilter, customDate]);

  async function fetchData() {
    setLoading(true);
    try {
      let startDate = new Date();
      let endDate = new Date();

      // LOGIQUE DES DATES POUR LA COMPTABILITÉ
      if (dateFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'month') {
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'custom') {
        startDate = new Date(customDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'all') {
        startDate = new Date("2020-01-01");
      }

      const isoStart = startDate.toISOString();
      const isoEnd = endDate.toISOString();

      // 1. Récupérer le LIVRE DES COMPTES
      const { data: txData, error: txErr } = await supabase
        .from("historique_paiements")
        .select(`*, commandes(contact_last_name, contact_first_name)`)
        .gte("date_paiement", isoStart)
        .lte("date_paiement", isoEnd)
        .order("date_paiement", { ascending: false });

      if (txErr) throw txErr;

      // 2. Récupérer les SESSIONS DE CAISSE (Ouverture/Clôture)
      const { data: sessionsData, error: sessErr } = await supabase
        .from("caisses_vendeurs")
        .select("*")
        .gte("created_at", isoStart)
        .lte("created_at", isoEnd)
        .order("created_at", { ascending: false });

      if (sessErr) throw sessErr;

      setTransactions(txData || []);
      setSessionsCaisse(sessionsData || []);

      // 3. Calcul des KPI financiers
      let sums = { stripe: 0, especes: 0, cb: 0, annulations: 0, totalNet: 0 };
      
      (txData || []).forEach(t => {
        const montantEuros = t.montant_cents / 100;
        
        if (montantEuros < 0) {
            sums.annulations += Math.abs(montantEuros);
        } else {
            if (t.moyen_paiement === 'stripe') sums.stripe += montantEuros;
            if (t.moyen_paiement === 'especes') sums.especes += montantEuros;
            if (t.moyen_paiement === 'cb') sums.cb += montantEuros;
        }
        sums.totalNet += montantEuros; 
      });
      
      setTotaux(sums);

    } catch (err) {
      console.error("Erreur Compta:", err);
    } finally {
      setLoading(false);
    }
  }

  const getBadgeStyle = (moyen, montant) => {
    if (montant < 0) return { icon: <FiTrash2 />, color: "bg-red-100 text-red-700 border-red-200", label: "Annulation" };
    switch(moyen) {
        case 'stripe': return { icon: <FiSmartphone />, color: "bg-purple-100 text-purple-700 border-purple-200", label: "Stripe Web" };
        case 'especes': return { icon: <FiDollarSign />, color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Espèces" };
        case 'cb': return { icon: <FiCreditCard />, color: "bg-blue-100 text-blue-700 border-blue-200", label: "TPE Bancaire" };
        default: return { icon: <FiFileText />, color: "bg-slate-100 text-slate-700 border-slate-200", label: moyen };
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Heure", "Ticket", "Client", "Moyen", "Type", "Montant Euros", "Caissier", "Notes"];
    const rows = transactions.map(t => [
        new Date(t.date_paiement).toLocaleDateString('fr-FR'),
        new Date(t.date_paiement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
        t.ticket_num,
        t.commandes ? `${t.commandes.contact_last_name} ${t.commandes.contact_first_name}` : "Client",
        t.moyen_paiement.toUpperCase(),
        t.montant_cents < 0 ? "REMBOURSEMENT" : "ENCAISSEMENT",
        (t.montant_cents / 100).toFixed(2),
        t.encaisse_par,
        t.notes ? `"${t.notes}"` : ""
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Comptabilite_${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 min-h-screen">
      
      {/* HEADER & FILTRES INTELLIGENTS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-yellow-500 rounded-xl text-white shadow-lg shadow-yellow-500/30"><FiDollarSign className="text-2xl" /></div>
            Centre Comptable
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Contrôle de trésorerie, suivi des caisses et journal financier.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex flex-wrap items-center shadow-inner">
            <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Aujourd'hui</button>
            <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Ce Mois</button>
            
            <div className="flex items-center gap-2 px-3 border-l border-slate-300 dark:border-slate-600 ml-2 pl-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Jour précis :</span>
                <input 
                    type="date" 
                    value={customDate} 
                    onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }} 
                    className={`text-sm px-3 py-2 rounded-xl outline-none font-bold transition-all ${dateFilter === 'custom' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-2 ring-indigo-500/20' : 'bg-transparent text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                />
            </div>
            
            <button onClick={() => setDateFilter('all')} className={`ml-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tout</button>
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-2 bg-slate-900 dark:bg-black hover:bg-slate-800 dark:hover:bg-slate-900 text-white px-5 py-3 rounded-2xl transition-all shadow-lg font-bold text-sm">
            <FiDownload /> Excel
          </button>
        </div>
      </div>

      {/* KPI FINANCIERS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5"><FiSmartphone/> Stripe Web</p>
            <p className="text-2xl font-black text-purple-600 mt-2">{totaux.stripe.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5"><FiCreditCard/> CB Guichet</p>
            <p className="text-2xl font-black text-blue-600 mt-2">{totaux.cb.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5"><FiDollarSign/> Espèces Guichet</p>
            <p className="text-2xl font-black text-emerald-600 mt-2">{totaux.especes.toFixed(2)} €</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-red-100 dark:border-red-900/30 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full"></div>
            <p className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5 relative z-10"><FiTrash2/> Annulations</p>
            <p className="text-2xl font-black text-red-500 mt-2 relative z-10">- {totaux.annulations.toFixed(2)} €</p>
        </div>
        <div className="bg-slate-900 dark:bg-black p-5 rounded-3xl shadow-lg col-span-2 md:col-span-1 border border-slate-800 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full"></div>
            <p className="text-xs font-bold text-slate-400 uppercase">Recette Nette Période</p>
            <p className="text-3xl font-black text-white mt-1 relative z-10">{totaux.totalNet.toFixed(2)} €</p>
        </div>
      </div>

      {/* NAVIGATION INTERNE (ONGLETS) */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
          <button onClick={() => setActiveTab('transactions')} className={`py-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <FiList /> Livre Journal (Détails)
          </button>
          <button onClick={() => setActiveTab('sessions')} className={`py-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'sessions' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <FiArchive /> Contrôle des Caisses
          </button>
      </div>

      {/* CONTENU ONGLETS */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        
        {loading ? (
            <div className="p-12 text-center text-slate-400 animate-pulse font-bold text-lg">Analyse comptable en cours...</div>
        ) : activeTab === 'transactions' ? (
            
            // ONGLET 1 : LIVRE JOURNAL DES TRANSACTIONS
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <tr>
                            <th className="p-5">Date & Heure</th>
                            <th className="p-5">Ticket / Client</th>
                            <th className="p-5">Opération</th>
                            <th className="p-5">Intervenant</th>
                            <th className="p-5">Note (Erreur)</th>
                            <th className="p-5 text-right">Montant Net</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {transactions.length === 0 ? (
                            <tr><td colSpan="6" className="p-12 text-center text-slate-500">Aucune transaction sur cette période.</td></tr>
                        ) : transactions.map((t) => {
                            const style = getBadgeStyle(t.moyen_paiement, t.montant_cents);
                            const montantEuro = t.montant_cents / 100;
                            const isNeg = montantEuro < 0;

                            return (
                                <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isNeg ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                    <td className="p-5">
                                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><FiCalendar className="text-slate-400"/> {new Date(t.date_paiement).toLocaleDateString('fr-FR')}</div>
                                        <div className="text-xs text-slate-500 mt-1 ml-5">{new Date(t.date_paiement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</div>
                                    </td>
                                    <td className="p-5">
                                        <p className="font-black text-slate-800 dark:text-white text-base">#{t.ticket_num}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{t.commandes ? `${t.commandes.contact_last_name} ${t.commandes.contact_first_name}` : "Client Inconnu"}</p>
                                    </td>
                                    <td className="p-5">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm ${style.color}`}>
                                            {style.icon} {style.label}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium"><FiUser className="text-slate-400"/> {t.encaisse_par.split('@')[0]}</span>
                                    </td>
                                    <td className="p-5 max-w-[200px]">
                                        {t.notes && <p className="text-xs text-red-700 font-bold bg-white dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-900/50 line-clamp-2" title={t.notes}>{t.notes}</p>}
                                    </td>
                                    <td className={`p-5 text-right font-black text-xl ${isNeg ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {isNeg ? "" : "+"}{montantEuro.toFixed(2)} €
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

        ) : (
            
            // ONGLET 2 : CONTROLE DES SESSIONS DE CAISSE
            <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/20">
                {sessionsCaisse.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">Aucune caisse n'a été ouverte sur cette période.</div>
                ) : sessionsCaisse.map(session => {
                    const isOuverte = session.statut === 'ouverte';
                    const aEcart = session.ecart_especes_cents !== 0 || session.ecart_cb_cents !== 0;

                    return (
                        <div key={session.id} className={`bg-white dark:bg-slate-800 border-2 rounded-3xl overflow-hidden ${isOuverte ? 'border-emerald-300 dark:border-emerald-700 shadow-xl shadow-emerald-100/50' : 'border-slate-200 dark:border-slate-700 shadow-md'}`}>
                            
                            <div className={`p-5 flex flex-wrap justify-between items-center gap-4 ${isOuverte ? 'bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-emerald-800' : 'border-b border-slate-100 dark:border-slate-700'}`}>
                                <div>
                                    <h4 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                                        <FiArchive className={isOuverte ? "text-emerald-500" : "text-slate-400"}/> 
                                        Caisse : {session.vendeur_email.split('@')[0]}
                                    </h4>
                                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                                        <FiClock /> Ouverture : {new Date(session.created_at).toLocaleString('fr-FR')}
                                        {session.heure_cloture && ` • Clôture : ${new Date(session.heure_cloture).toLocaleTimeString('fr-FR')}`}
                                    </p>
                                </div>
                                <div>
                                    {isOuverte ? (
                                        <span className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-emerald-500 text-white shadow-md flex items-center gap-2"><FiUnlock/> En cours d'utilisation</span>
                                    ) : (
                                        <span className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 flex items-center gap-2"><FiCheckCircle/> Clôturée</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fond de caisse (Matin)</p>
                                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{(session.fond_caisse_initial_cents / 100).toFixed(2)} €</p>
                                </div>

                                <div className="md:col-span-2 grid grid-cols-2 gap-6 border-x border-slate-100 dark:border-slate-700 px-6">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Théorique (Ordi)</p>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-700">
                                            <div className="flex justify-between text-sm"><span className="text-slate-500">Espèces:</span><strong className="text-slate-800 dark:text-white">{((session.total_theorique_especes_cents||0)/100).toFixed(2)}€</strong></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-500">CB TPE:</span><strong className="text-slate-800 dark:text-white">{((session.total_theorique_cb_cents||0)/100).toFixed(2)}€</strong></div>
                                        </div>
                                    </div>
                                    <div className={!isOuverte ? "opacity-100" : "opacity-30 blur-[1px] select-none"}>
                                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 text-center">Réel (Déclaré le soir)</p>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl space-y-2 border border-blue-100 dark:border-blue-900/30">
                                            <div className="flex justify-between text-sm"><span className="text-blue-600 dark:text-blue-400">Espèces:</span><strong className="text-blue-800 dark:text-blue-300">{((session.total_reel_especes_cents||0)/100).toFixed(2)}€</strong></div>
                                            <div className="flex justify-between text-sm"><span className="text-blue-600 dark:text-blue-400">CB TPE:</span><strong className="text-blue-800 dark:text-blue-300">{((session.total_reel_cb_cents||0)/100).toFixed(2)}€</strong></div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bilan & Écarts</p>
                                    {!isOuverte ? (
                                        aEcart ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-red-700 font-bold text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
                                                    <FiAlertTriangle className="text-lg"/> Écart détecté
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl italic border border-slate-200 dark:border-slate-700 shadow-sm relative">
                                                    <span className="absolute -top-2 -left-2 text-2xl text-slate-300">"</span>
                                                    {session.justification_ecart}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                                                <FiCheckCircle className="text-lg"/> Caisse juste (0€)
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm font-medium text-slate-400 italic mt-4">Bilan disponible à la clôture du guichet.</p>
                                    )}
                                </div>

                            </div>
                        </div>
                    )
                })}
            </div>
        )}
      </div>

    </div>
  );
}