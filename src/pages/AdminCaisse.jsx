import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiDollarSign, FiCreditCard, FiFileText, FiDownload, FiUser, 
  FiCalendar, FiSmartphone, FiArchive, FiAlertTriangle, FiCheckCircle, 
  FiClock, FiTrash2, FiList, FiUnlock, FiSettings, FiSave, FiTag
} from "react-icons/fi";
import { logAction } from "../lib/logger";
import { useNotification } from "../contexts/NotificationContext";

export default function AdminCaisse() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [sessionsCaisse, setSessionsCaisse] = useState([]);
  
  // États des Tarifs
  const [tarifs, setTarifs] = useState([]);
  const [loadingTarifs, setLoadingTarifs] = useState(false);

  // Filtres
  const [dateFilter, setDateFilter] = useState("today"); 
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("transactions"); 

  const [totaux, setTotaux] = useState({ stripe: 0, especes: 0, cb: 0, annulations: 0, totalNet: 0 });

  useEffect(() => {
    fetchData();
    fetchTarifs(); // Charge les tarifs au démarrage
    
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

  // ================= CHARGEMENT COMPTABILITÉ =================
  async function fetchData() {
    setLoading(true);
    try {
      let startDate = new Date();
      let endDate = new Date();

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

      const { data: txData, error: txErr } = await supabase
        .from("historique_paiements")
        .select(`*, commandes(contact_last_name, contact_first_name)`)
        .gte("date_paiement", isoStart)
        .lte("date_paiement", isoEnd)
        .order("date_paiement", { ascending: false });
      if (txErr) throw txErr;

      const { data: sessionsData, error: sessErr } = await supabase
        .from("caisses_vendeurs")
        .select("*")
        .gte("created_at", isoStart)
        .lte("created_at", isoEnd)
        .order("created_at", { ascending: false });
      if (sessErr) throw sessErr;

      setTransactions(txData || []);
      setSessionsCaisse(sessionsData || []);

      // === CORRECTION ICI : Tolérance sur les textes de paiement ===
      let sums = { stripe: 0, especes: 0, cb: 0, annulations: 0, totalNet: 0 };
      (txData || []).forEach(t => {
        const montantEuros = t.montant_cents / 100;
        
        if (montantEuros < 0) {
            sums.annulations += Math.abs(montantEuros);
        } else {
            // Sécurise la vérification en mettant tout en minuscules pour éviter les bugs de casse
            const moyen = String(t.moyen_paiement || "").toLowerCase().trim();
            
            if (moyen === 'stripe' || moyen === 'carte' || moyen === 'card') {
                sums.stripe += montantEuros;
            } else if (moyen === 'especes' || moyen === 'espece') {
                sums.especes += montantEuros;
            } else if (moyen === 'cb' || moyen === 'tpe') {
                sums.cb += montantEuros;
            }
        }
        sums.totalNet += montantEuros; 
      });
      setTotaux(sums);
      // ==============================================================

    } catch (err) {
      console.error("Erreur Compta:", err);
    } finally {
      setLoading(false);
    }
  }

  // ================= CHARGEMENT DES TARIFS =================
  async function fetchTarifs() {
      try {
          const { data, error } = await supabase.from('tarifs').select('*').order('categorie', { ascending: true });
          if (error) throw error;
          
          if (data) {
              const formatedTarifs = data.map(t => ({
                  ...t,
                  prixEuros: t.prix_cents !== null ? (t.prix_cents / 100).toString() : "0",
                  acompteEuros: t.acompte_cents !== null ? (t.acompte_cents / 100).toString() : "50" 
              }));
              setTarifs(formatedTarifs);
          }
      } catch (err) {
          console.error("Erreur tarifs:", err);
      }
  }

  // Modification locale dans les inputs (utilisation de categorie au lieu de id)
  const handleTarifChange = (categorie, field, value) => {
      setTarifs(tarifs.map(t => t.categorie === categorie ? { ...t, [field]: value } : t));
  };

  // ================= SAUVEGARDE DES TARIFS =================
  const saveTarifs = async () => {
      setLoadingTarifs(true);
      try {
          for (const t of tarifs) {
              const prixCents = Math.round(parseFloat(t.prixEuros || 0) * 100);
              const acompteCents = Math.round(parseFloat(t.acompteEuros || 0) * 100);
              
              const { error } = await supabase
                .from('tarifs')
                .update({ 
                    prix_cents: prixCents, 
                    acompte_cents: acompteCents 
                })
                .eq('categorie', t.categorie);

              if (error) throw error;
          }

          showNotification("Paramètres de vente mis à jour avec succès !", "success");
          logAction('MODIFICATION', 'SYSTEME', { action: "Mise à jour des prix de vente et acomptes" });
          
          // On force le rechargement depuis la base pour être sûr de l'affichage
          await fetchTarifs(); 

      } catch (err) {
          console.error(err);
          showNotification("Erreur lors de la sauvegarde des tarifs.", "error");
      } finally {
          setLoadingTarifs(false);
      }
  };

  const getBadgeStyle = (moyen, montant) => {
    if (montant < 0) return { icon: <FiTrash2 />, color: "bg-red-100 text-red-700 border-red-200", label: "Annulation" };
    const m = String(moyen || "").toLowerCase().trim();
    if (m === 'stripe' || m === 'carte' || m === 'card') return { icon: <FiSmartphone />, color: "bg-purple-100 text-purple-700 border-purple-200", label: "Stripe Web" };
    if (m === 'especes' || m === 'espece') return { icon: <FiDollarSign />, color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Espèces" };
    if (m === 'cb' || m === 'tpe') return { icon: <FiCreditCard />, color: "bg-blue-100 text-blue-700 border-blue-200", label: "TPE Bancaire" };
    return { icon: <FiFileText />, color: "bg-slate-100 text-slate-700 border-slate-200", label: moyen };
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
    link.setAttribute("href", encodedUri); link.setAttribute("download", `Comptabilite_${dateFilter}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    logAction('EXPORT', 'CAISSE', { action: 'Export du journal de caisse' });
  };

  return (
    <div className="p-6 md:p-8 space-y-8 min-h-screen animate-fade-in">
      
      {/* HEADER & FILTRES */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-yellow-500 rounded-xl text-white shadow-lg shadow-yellow-500/30"><FiDollarSign className="text-2xl" /></div>
            Centre Comptable
          </h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Contrôle de trésorerie, suivi des caisses et paramètres de vente.</p>
        </div>
        
        {activeTab !== 'settings' && (
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex flex-wrap items-center shadow-inner">
                <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Aujourd'hui</button>
                <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Ce Mois</button>
                <div className="flex items-center gap-2 px-3 border-l border-slate-300 dark:border-slate-600 ml-2 pl-4">
                    <span className="text-xs font-bold text-slate-400 uppercase">Jour précis :</span>
                    <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }} className={`text-sm px-3 py-2 rounded-xl outline-none font-bold transition-all ${dateFilter === 'custom' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-2 ring-indigo-500/20' : 'bg-transparent text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'}`} />
                </div>
                <button onClick={() => setDateFilter('all')} className={`ml-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tout</button>
            </div>
            <button onClick={exportToCSV} className="flex items-center gap-2 bg-slate-900 dark:bg-black hover:bg-slate-800 dark:hover:bg-slate-900 text-white px-5 py-3 rounded-2xl transition-all shadow-lg font-bold text-sm">
                <FiDownload /> Excel
            </button>
            </div>
        )}
      </div>

      {/* KPI FINANCIERS */}
      {activeTab !== 'settings' && (
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
      )}

      {/* NAVIGATION INTERNE (3 ONGLETS) */}
      <div className="flex flex-wrap gap-4 border-b border-slate-200 dark:border-slate-700">
          <button onClick={() => setActiveTab('transactions')} className={`py-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <FiList /> Livre Journal
          </button>
          <button onClick={() => setActiveTab('sessions')} className={`py-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'sessions' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <FiArchive /> Contrôle Caisses
          </button>
          <button onClick={() => setActiveTab('settings')} className={`py-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-500' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
              <FiSettings /> Paramètres de Vente
          </button>
      </div>

      {/* CONTENU ONGLETS */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        
        {loading && activeTab !== 'settings' ? (
            <div className="p-12 text-center text-slate-400 animate-pulse font-bold text-lg">Analyse comptable en cours...</div>
        ) : activeTab === 'transactions' ? (
            
            // ONGLET 1 : LIVRE JOURNAL
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <tr><th className="p-5">Date & Heure</th><th className="p-5">Ticket / Client</th><th className="p-5">Opération</th><th className="p-5">Intervenant</th><th className="p-5">Note (Erreur)</th><th className="p-5 text-right">Montant Net</th></tr>
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
                                    <td className="p-5"><span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm ${style.color}`}>{style.icon} {style.label}</span></td>
                                    <td className="p-5"><span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium"><FiUser className="text-slate-400"/> {t.encaisse_par?.split('@')[0]}</span></td>
                                    <td className="p-5 max-w-[200px]">{t.notes && <p className="text-xs text-red-700 font-bold bg-white dark:bg-red-900/30 p-2 rounded-lg border border-red-100 dark:border-red-900/50 line-clamp-2" title={t.notes}>{t.notes}</p>}</td>
                                    <td className={`p-5 text-right font-black text-xl ${isNeg ? 'text-red-500' : 'text-emerald-600'}`}>{isNeg ? "" : "+"}{montantEuro.toFixed(2)} €</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

        ) : activeTab === 'sessions' ? (
            
            // ONGLET 2 : CONTROLE DES CAISSES
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
                                    <h4 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2"><FiArchive className={isOuverte ? "text-emerald-500" : "text-slate-400"}/> Caisse : {session.vendeur_email?.split('@')[0]}</h4>
                                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 font-medium"><FiClock /> Ouverture : {new Date(session.created_at).toLocaleString('fr-FR')}{session.heure_cloture && ` • Clôture : ${new Date(session.heure_cloture).toLocaleTimeString('fr-FR')}`}</p>
                                </div>
                                <div>{isOuverte ? <span className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-emerald-500 text-white shadow-md flex items-center gap-2"><FiUnlock/> En cours d'utilisation</span> : <span className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 flex items-center gap-2"><FiCheckCircle/> Clôturée</span>}</div>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fond de caisse</p><p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{(session.fond_caisse_initial_cents / 100).toFixed(2)} €</p></div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-6 border-x border-slate-100 dark:border-slate-700 px-6">
                                    <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Théorique (Ordi)</p><div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-700"><div className="flex justify-between text-sm"><span className="text-slate-500">Espèces:</span><strong className="text-slate-800 dark:text-white">{((session.total_theorique_especes_cents||0)/100).toFixed(2)}€</strong></div><div className="flex justify-between text-sm"><span className="text-slate-500">CB TPE:</span><strong className="text-slate-800 dark:text-white">{((session.total_theorique_cb_cents||0)/100).toFixed(2)}€</strong></div></div></div>
                                    <div className={!isOuverte ? "opacity-100" : "opacity-30 blur-[1px] select-none"}><p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 text-center">Réel (Déclaré)</p><div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl space-y-2 border border-blue-100 dark:border-blue-900/30"><div className="flex justify-between text-sm"><span className="text-blue-600 dark:text-blue-400">Espèces:</span><strong className="text-blue-800 dark:text-blue-300">{((session.total_reel_especes_cents||0)/100).toFixed(2)}€</strong></div><div className="flex justify-between text-sm"><span className="text-blue-600 dark:text-blue-400">CB TPE:</span><strong className="text-blue-800 dark:text-blue-300">{((session.total_reel_cb_cents||0)/100).toFixed(2)}€</strong></div></div></div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bilan & Écarts</p>
                                    {!isOuverte ? (aEcart ? (<div className="space-y-3"><div className="flex items-center gap-2 text-red-700 font-bold text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50"><FiAlertTriangle className="text-lg"/> Écart détecté</div><p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl italic border border-slate-200 dark:border-slate-700 shadow-sm relative"><span className="absolute -top-2 -left-2 text-2xl text-slate-300">"</span>{session.justification_ecart}</p></div>) : (<div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50"><FiCheckCircle className="text-lg"/> Caisse juste (0€)</div>)) : (<p className="text-sm font-medium text-slate-400 italic mt-4">Bilan disponible à la clôture.</p>)}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

        ) : (
            
            // ONGLET 3 : PARAMETRES DE VENTE
            <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/20 animate-fade-in">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3"><FiTag className="text-yellow-500" /> Configuration des Prix & Acomptes</h3>
                        <p className="text-slate-500 text-sm mt-2">Définissez le prix total de l'agneau et le montant de l'acompte que le client doit payer sur le site (Stripe) pour valider sa réservation.</p>
                    </div>

                    {loadingTarifs ? (
                        <p className="text-center text-slate-400 py-10 animate-pulse font-bold">Chargement des tarifs en cours...</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {tarifs.map(t => (
                                <div key={t.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-lg hover:border-yellow-200 dark:hover:border-yellow-900">
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 rounded-full flex items-center justify-center text-2xl font-black border border-yellow-100 dark:border-yellow-900/50">
                                            {t.categorie}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xl text-slate-800 dark:text-white">{t.nom}</h4>
                                            <p className="text-slate-500 text-sm mt-1">Modifiez les tarifs ci-contre.</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Acompte Stripe <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-slate-400 font-bold text-lg">€</span></div>
                                                <input 
                                                    type="number" step="0.01" 
                                                    value={t.acompteEuros || ""} 
                                                    onChange={(e) => handleTarifChange(t.categorie, 'acompteEuros', e.target.value)} 
                                                    className="w-full sm:w-36 pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-black text-lg outline-none focus:border-yellow-500 dark:text-white transition-all" 
                                                />
                                            </div>
                                        </div>
                                        <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prix Total <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-slate-400 font-bold text-lg">€</span></div>
                                                <input 
                                                    type="number" step="0.01" 
                                                    value={t.prixEuros || ""} 
                                                    onChange={(e) => handleTarifChange(t.categorie, 'prixEuros', e.target.value)} 
                                                    className="w-full sm:w-36 pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-black text-lg outline-none focus:border-yellow-500 dark:text-white transition-all" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-8 flex justify-end">
                        <button 
                            onClick={saveTarifs} 
                            disabled={loadingTarifs} 
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-yellow-500/30 flex items-center gap-3 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 text-lg"
                        >
                            {loadingTarifs ? "Sauvegarde..." : <>Sauvegarder la grille tarifaire <FiSave className="text-xl" /></>}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}