import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  FiSearch, FiCreditCard, FiDollarSign, FiFileText, FiActivity, 
  FiUser, FiCheckCircle, FiCamera, FiX, FiGlobe, FiArrowRight, FiList, FiArrowLeft, FiTrash2, FiAlertTriangle 
} from "react-icons/fi";

export default function PriseEnCharge() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  
  // États recherche & Scanner
  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  
  // États de sélection
  const [commande, setCommande] = useState(null);
  const [searchResults, setSearchResults] = useState([]); 
  const [historiquePaiements, setHistoriquePaiements] = useState([]);

  // États encaissement
  const [montantEncaisse, setMontantEncaisse] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [loadingPaiement, setLoadingPaiement] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  // --- LOGIQUES METIER (Identiques à avant) ---
  const handleSearch = async (e, overrideVal = null) => {
    if (e) e.preventDefault();
    const val = overrideVal || searchInput;
    if (!val) return;
    setLoading(true); setCommande(null); setSearchResults([]); setHistoriquePaiements([]); setShowScanner(false);
    try {
      let query = supabase.from("commandes").select("*, creneaux_horaires(*)");
      const cleanVal = val.trim();
      const isDigits = /^\d+$/.test(cleanVal);
      if (isDigits) {
        if (cleanVal.startsWith('0') || cleanVal.length > 5) query = query.ilike('contact_phone', `%${cleanVal}%`);
        else query = query.eq("ticket_num", parseInt(cleanVal));
      } else {
        query = query.or(`contact_last_name.ilike.%${cleanVal}%,contact_first_name.ilike.%${cleanVal}%,contact_email.ilike.%${cleanVal}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) showNotification("Aucun résultat trouvé.", "error");
      else if (data.length === 1) selectCommande(data[0]);
      else { setSearchResults(data); showNotification(`${data.length} résultats trouvés.`, "info"); }
    } catch (err) { console.error(err); showNotification("Erreur recherche.", "error"); } finally { setLoading(false); }
  };

  const selectCommande = (cmd) => { setCommande(cmd); setSearchInput(cmd.ticket_num.toString()); fetchHistorique(cmd.id); };
  const handleBackToList = () => { setCommande(null); setSearchInput(""); };
  const fetchHistorique = async (commandeId) => {
    const { data, error } = await supabase.from("paiements").select("*").eq("commande_id", commandeId).order("created_at", { ascending: false });
    if (!error) setHistoriquePaiements(data || []);
  };
  const requestDelete = (paiement) => { setPaymentToDelete(paiement); setShowDeleteModal(true); };
  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    setLoadingPaiement(true);
    try {
        const { error } = await supabase.rpc("supprimer_encaissement", { p_paiement_id: paymentToDelete.id });
        if (error) throw error;
        showNotification("Paiement annulé.", "info");
        const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
        if(data) { setCommande(data); fetchHistorique(data.id); }
        setShowDeleteModal(false); setPaymentToDelete(null);
    } catch (err) { console.error(err); showNotification("Erreur: " + err.message, "error"); } finally { setLoadingPaiement(false); }
  };
  const handleScan = (result) => {
    if (result) {
      const rawValue = result[0]?.rawValue || result?.rawValue || result;
      if (rawValue) {
        try {
           const parsed = JSON.parse(rawValue);
           if (parsed.ticket_num) handleSearch(null, parsed.ticket_num);
           else if (parsed.id) loadCommandeById(parsed.id);
           else handleSearch(null, rawValue);
        } catch { handleSearch(null, rawValue); }
      }
    }
  };
  const loadCommandeById = async (uuid) => {
      setLoading(true);
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", uuid).maybeSingle();
      if(data) { selectCommande(data); setShowScanner(false); } else { showNotification("Commande introuvable par ID.", "error"); }
      setLoading(false);
  }
  const handlePaiement = async (e) => {
    e.preventDefault();
    if (!montantEncaisse || parseFloat(montantEncaisse) <= 0) return;
    setLoadingPaiement(true);
    try {
      const { error } = await supabase.rpc("ajouter_encaissement", { p_commande_id: commande.id, p_montant: parseFloat(montantEncaisse), p_moyen: modePaiement, p_reference: null });
      if (error) throw error;
      showNotification("Paiement enregistré !", "success"); setMontantEncaisse("");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if(data) { setCommande(data); fetchHistorique(data.id); setSearchResults(prev => prev.map(p => p.id === data.id ? data : p)); }
    } catch (err) { console.error(err); showNotification("Erreur: " + err.message, "error"); } finally { setLoadingPaiement(false); }
  };

  const total = commande ? (commande.montant_total_cents / 100) : 0;
  const dejaPaye = commande ? ((commande.montant_paye_cents || commande.acompte_cents) / 100) : 0;
  const resteAPayer = Math.max(0, total - dejaPaye);
  const isPaye = resteAPayer < 0.05; 
  const clientName = commande ? `${commande.contact_last_name || ""} ${commande.contact_first_name || ""}` : "Client Inconnu";
  const getPaymentIcon = (moyen) => {
      switch(moyen) { case 'especes': return <FiDollarSign />; case 'cb': return <FiCreditCard />; case 'stripe_online': return <FiGlobe />; default: return <FiFileText />; }
  };
  const getPaymentLabel = (moyen) => {
      switch(moyen) { case 'especes': return 'Espèces'; case 'cb': return 'Carte Bancaire'; case 'stripe_online': return 'Paiement Web'; case 'cheque': return 'Chèque'; default: return moyen; }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
             <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30"><FiCreditCard className="text-2xl" /></div>
             Caisse
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Recherche par Ticket, Nom ou Email.</p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Opérateur</p>
            <p className="font-bold text-slate-700 dark:text-white">Staff Connecté</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-700">
              <div className="p-5 space-y-4">
                <button 
                    id="caisse-scanner" // <--- ID AJOUTÉ
                    onClick={() => setShowScanner(true)}
                    className="group w-full py-5 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:scale-95"
                >
                    <div className="bg-white/20 p-2 rounded-full group-hover:rotate-12 transition-transform"><FiCamera className="text-2xl" /></div>
                    <span className="font-bold text-lg tracking-wide">Scanner un Ticket</span>
                </button>

                <div className="relative group">
                    <form onSubmit={(e) => handleSearch(e)} className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <FiSearch className="text-slate-400 text-xl group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            id="caisse-search" // <--- ID AJOUTÉ
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="N° Ticket, Nom ou Email..."
                            className="block w-full pl-12 pr-16 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all"
                        />
                        <button type="submit" disabled={loading || !searchInput} className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shadow-md">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSearch className="text-xl" />}
                        </button>
                    </form>
                </div>
              </div>
          </div>

          {!commande && searchResults.length > 0 && (
             <div id="caisse-results" className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up"> 
               {/* ^--- ID AJOUTÉ */}
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-2"><FiList /> Résultats ({searchResults.length})</h3>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {searchResults.map(res => (
                        <button key={res.id} onClick={() => selectCommande(res)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm font-bold">#{res.ticket_num}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold border ${res.statut === 'paye' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>{res.statut}</span>
                                </div>
                                <div className="text-sm font-medium text-slate-800 dark:text-white mt-1">{res.contact_last_name} {res.contact_first_name}</div>
                            </div>
                            <FiArrowRight className="text-slate-300 group-hover:text-indigo-500 transition-colors text-xl" />
                        </button>
                    ))}
                </div>
             </div>
          )}

          {commande && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
              <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      {searchResults.length > 0 && (
                          <button onClick={handleBackToList} className="p-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-slate-200 transition-all">
                             <FiArrowLeft className="text-lg" />
                          </button>
                      )}
                      <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><FiUser className="text-indigo-500" /> #{commande.ticket_num}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${isPaye ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{isPaye ? "Soldé" : "À Payer"}</span>
              </div>
              <div className="p-6 space-y-5">
                {/* Details client ... */}
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Client</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white">{clientName}</p>
                    <p className="text-sm text-slate-500">{commande.contact_email}</p>
                </div>
                {/* ... */}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 space-y-6">
          {commande ? (
            <>
              <div id="caisse-payment-form" className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row">
                {/* ^--- ID AJOUTÉ */}
                
                <div className="md:w-1/3 bg-slate-50 dark:bg-slate-900/80 p-6 md:p-8 flex flex-col justify-between border-r border-slate-200 dark:border-slate-700">
                    <div className="space-y-6">
                        <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prix Total</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{total.toFixed(2)} €</p></div>
                        <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Déjà versé</p><div className="flex items-center gap-2 mt-1 text-emerald-600 dark:text-emerald-400"><FiCheckCircle /><p className="text-xl font-bold">{dejaPaye.toFixed(2)} €</p></div></div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reste à Payer</p>
                        <p className={`text-4xl font-black tracking-tight ${isPaye ? "text-emerald-500" : "text-slate-900 dark:text-white"}`}>{isPaye ? "OK" : <span>{resteAPayer.toFixed(2)}<span className="text-lg text-slate-400 ml-1">€</span></span>}</p>
                    </div>
                </div>

                <div className="md:w-2/3 p-6 md:p-8 bg-white dark:bg-slate-800">
                    {!isPaye ? (
                        <form onSubmit={handlePaiement} className="h-full flex flex-col justify-between space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Moyen de paiement</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['especes', 'cb', 'cheque'].map(mode => (
                                        <button key={mode} type="button" onClick={() => setModePaiement(mode)} className={`relative py-4 px-2 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${modePaiement === mode ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-500 shadow-md ring-1 ring-indigo-200 dark:ring-indigo-800" : "border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                                            <div className="text-2xl">{getPaymentIcon(mode)}</div><span className="text-xs font-bold uppercase">{mode === 'cb' ? 'Carte' : mode}</span>{modePaiement === mode && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full"></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Montant à encaisser</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><span className="text-slate-400 text-2xl font-bold">€</span></div>
                                    <input type="number" step="0.01" value={montantEncaisse} onChange={(e) => setMontantEncaisse(e.target.value)} className="block w-full pl-12 pr-28 py-5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-3xl font-bold text-slate-900 dark:text-white placeholder-slate-300 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all" placeholder="0.00" />
                                    <button type="button" onClick={() => setMontantEncaisse(resteAPayer.toFixed(2))} className="absolute right-3 top-3 bottom-3 px-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors uppercase tracking-wider shadow-sm">Le Solde</button>
                                </div>
                            </div>
                            <button type="submit" disabled={loadingPaiement || !montantEncaisse} className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                                {loadingPaiement ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><span className="uppercase tracking-wide">Confirmer l'encaissement</span><FiArrowRight className="text-xl" /></>}
                            </button>
                        </form>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center animate-bounce-slow"><FiCheckCircle className="text-5xl" /></div>
                            <div><h3 className="text-2xl font-bold text-slate-800 dark:text-white">Commande Soldée</h3><p className="text-slate-500 dark:text-slate-400 mt-2">Le client est à jour.</p></div>
                            <button onClick={() => { setCommande(null); setSearchInput(""); setSearchResults([]); }} className="mt-6 px-8 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors">Nouvelle Recherche</button>
                        </div>
                    )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><FiActivity className="text-slate-400" /> Historique détaillé</h3>
                {historiquePaiements.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200"><p className="text-slate-400 italic">Aucun mouvement enregistré.</p></div>
                ) : (
                    <div className="space-y-4">
                        {historiquePaiements.map((p) => (
                            <div key={p.id} className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
                                {/* ... Details Paiement ... */}
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="block font-bold text-emerald-600 text-lg">+ {Number(p.montant).toFixed(2)} €</span>
                                        {p.reference && <span className="text-[10px] text-slate-400 uppercase tracking-wide">Ref: {p.reference}</span>}
                                    </div>
                                    <button onClick={() => requestDelete(p)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Annuler ce paiement (Audit Log)"><FiTrash2 className="text-xl" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-12 text-center opacity-70">
                <img src="https://illustrations.popsy.co/gray/success.svg" className="w-48 h-48 opacity-50 grayscale mb-6" alt="Empty" />
                <h3 className="text-xl font-bold text-slate-400">Prêt à encaisser</h3>
                <p className="text-slate-400 mt-2 max-w-xs mx-auto">Scannez un QR code ou entrez un numéro de ticket, un nom ou un email à gauche.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals Scanner & Delete (inchangés mais inclus pour compilation) */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
            <button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors"><FiX className="text-3xl" /></button>
            <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden border-4 border-indigo-500 shadow-2xl relative aspect-square"><Scanner onScan={handleScan} /></div>
        </div>
      )}
      {showDeleteModal && paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border-t-8 border-red-500 overflow-hidden transform transition-all scale-100">
                <div className="p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-pulse"><FiAlertTriangle /></div>
                    <div><h3 className="text-2xl font-bold text-slate-900 dark:text-white">Annulation de paiement</h3><p className="text-slate-500 dark:text-slate-400 mt-2">Vous êtes sur le point de supprimer un encaissement de <strong className="text-slate-900 dark:text-white">{paymentToDelete.montant} €</strong>.</p></div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-4 rounded-xl text-left text-sm text-red-800 dark:text-red-200"><p className="font-bold flex items-center gap-2 mb-1"><FiActivity/> Audit de Sécurité</p><p>Cette action est irréversible. Elle sera <strong>enregistrée et notifiée</strong> immédiatement à l'administrateur dans le journal de sécurité.</p></div>
                    <div className="flex gap-4 pt-2">
                        <button onClick={() => { setShowDeleteModal(false); setPaymentToDelete(null); }} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl transition-colors">Annuler</button>
                        <button onClick={confirmDelete} disabled={loadingPaiement} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-colors flex justify-center items-center gap-2">{loadingPaiement ? "Traitement..." : "Confirmer la suppression"}</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}