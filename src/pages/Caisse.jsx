import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  FiSearch, FiCreditCard, FiDollarSign, FiFileText, 
  FiUser, FiCheckCircle, FiCamera, FiX, FiArrowRight, FiList, FiArrowLeft, FiTag 
} from "react-icons/fi";

export default function Caisse() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  
  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  
  const [commande, setCommande] = useState(null);
  const [searchResults, setSearchResults] = useState([]); 

  const [montantEncaisse, setMontantEncaisse] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [loadingPaiement, setLoadingPaiement] = useState(false);

  const handleSearch = async (e, overrideVal = null) => {
    if (e) e.preventDefault();
    const val = overrideVal || searchInput;
    if (!val) return;
    setLoading(true); setCommande(null); setSearchResults([]); setShowScanner(false);
    try {
      let query = supabase.from("commandes").select("*, creneaux_horaires(*)");
      const cleanVal = val.toString().trim();
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
    } catch (err) { showNotification("Erreur recherche.", "error"); } finally { setLoading(false); }
  };

  const selectCommande = (cmd) => { setCommande(cmd); setSearchInput(cmd.ticket_num?.toString() || ""); };
  const handleBackToList = () => { setCommande(null); setSearchInput(""); };

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
      if(data) { selectCommande(data); setShowScanner(false); } 
      else { showNotification("Commande introuvable par ID.", "error"); }
      setLoading(false);
  }

  // ENCAISSEMENT FINAL
  const handlePaiement = async (e) => {
    e.preventDefault();
    if (!montantEncaisse || parseFloat(montantEncaisse) <= 0) return;
    setLoadingPaiement(true);
    try {
      // 1. On enregistre le paiement dans la comptabilité
      const { error: errPaiement } = await supabase.rpc("ajouter_encaissement", { 
          p_commande_id: commande.id, 
          p_montant: parseFloat(montantEncaisse), 
          p_moyen: modePaiement, 
          p_reference: null 
      });
      if (errPaiement) throw errPaiement;

      // 2. Si le solde est réglé, on valide définitivement le ticket
      const nouveauPaye = dejaPaye + parseFloat(montantEncaisse);
      if (nouveauPaye >= total - 0.05) {
          await supabase.from('commandes').update({ statut: 'paye_integralement' }).eq('id', commande.id);
      }

      showNotification("Paiement enregistré avec succès !", "success"); 
      setMontantEncaisse("");
      
      // Rafraîchir l'affichage
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if(data) setCommande(data); 

    } catch (err) { showNotification("Erreur lors de l'encaissement.", "error"); } finally { setLoadingPaiement(false); }
  };

  // CALCULS
  const total = commande ? (commande.montant_total_cents / 100) : 0;
  const dejaPaye = commande ? ((commande.montant_paye_cents || commande.acompte_cents) / 100) : 0;
  const resteAPayer = Math.max(0, total - dejaPaye);
  const isPaye = resteAPayer < 0.05; 

  const getPaymentIcon = (moyen) => {
      switch(moyen) { case 'especes': return <FiDollarSign />; case 'cb': return <FiCreditCard />; default: return <FiFileText />; }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen pt-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
             <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30"><FiCreditCard className="text-2xl" /></div>
             Caisse (Guichet)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Encaissement du solde final des clients.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* COLONNE GAUCHE : RECHERCHE */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
              <div className="p-5 space-y-4">
                <button 
                    onClick={() => setShowScanner(true)}
                    className="group w-full py-5 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:scale-95"
                >
                    <div className="bg-white/20 p-2 rounded-full"><FiCamera className="text-2xl" /></div>
                    <span className="font-bold text-lg tracking-wide">Scanner un Ticket</span>
                </button>

                <div className="relative group">
                    <form onSubmit={(e) => handleSearch(e)} className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <FiSearch className="text-slate-400 text-xl group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="N° Ticket, Nom ou Email..."
                            className="block w-full pl-12 pr-16 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 outline-none transition-all"
                        />
                        <button type="submit" disabled={loading || !searchInput} className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSearch className="text-xl" />}
                        </button>
                    </form>
                </div>
              </div>
          </div>
        </div>

        {/* COLONNE DROITE : ENCAISSEMENT */}
        <div className="xl:col-span-2 space-y-6">
          {commande ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row">
                
                {/* Résumé du prix */}
                <div className="md:w-1/3 bg-slate-50 dark:bg-slate-900/80 p-6 flex flex-col justify-between border-r border-slate-200 dark:border-slate-700">
                    <div className="space-y-6">
                        <div>
                            <button onClick={handleBackToList} className="mb-4 text-indigo-500 text-sm font-bold flex items-center gap-1 hover:text-indigo-700"><FiArrowLeft /> Retour</button>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket N°</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white">{commande.ticket_num}</p>
                            <p className="text-sm font-bold text-slate-500 mt-2">{commande.contact_last_name} {commande.contact_first_name}</p>
                            {commande.numero_boucle && (
                                <p className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-200"><FiTag /> Boucle: {commande.numero_boucle}</p>
                            )}
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            <div className="flex justify-between text-sm mb-2"><span className="text-slate-500">Prix Total</span><span className="font-bold">{total.toFixed(2)} €</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Acompte Stripe</span><span className="font-bold text-emerald-600">- {dejaPaye.toFixed(2)} €</span></div>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reste à Payer</p>
                        <p className={`text-4xl font-black tracking-tight ${isPaye ? "text-emerald-500" : "text-slate-900 dark:text-white"}`}>{isPaye ? "OK" : `${resteAPayer.toFixed(2)} €`}</p>
                    </div>
                </div>

                {/* Formulaire de paiement */}
                <div className="md:w-2/3 p-6 bg-white dark:bg-slate-800">
                    {!isPaye ? (
                        <form onSubmit={handlePaiement} className="h-full flex flex-col justify-between space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Moyen de paiement</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['especes', 'cb', 'cheque'].map(mode => (
                                        <button key={mode} type="button" onClick={() => setModePaiement(mode)} className={`relative py-4 px-2 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${modePaiement === mode ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-1 ring-indigo-200" : "border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                                            <div className="text-2xl">{getPaymentIcon(mode)}</div><span className="text-xs font-bold uppercase">{mode === 'cb' ? 'Carte' : mode}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Montant encaissé</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><span className="text-slate-400 text-2xl font-bold">€</span></div>
                                    <input type="number" step="0.01" value={montantEncaisse} onChange={(e) => setMontantEncaisse(e.target.value)} className="block w-full pl-12 pr-28 py-5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 rounded-2xl text-3xl font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all" placeholder="0.00" />
                                    <button type="button" onClick={() => setMontantEncaisse(resteAPayer.toFixed(2))} className="absolute right-3 top-3 bottom-3 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 uppercase tracking-wider shadow-sm hover:bg-indigo-50">Le Solde</button>
                                </div>
                            </div>
                            <button type="submit" disabled={loadingPaiement || !montantEncaisse} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3 transition-all disabled:opacity-50">
                                {loadingPaiement ? "Traitement..." : <>Valider l'encaissement <FiArrowRight className="text-xl" /></>}
                            </button>
                        </form>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce-slow"><FiCheckCircle className="text-5xl" /></div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-4">Commande Soldée</h3>
                            <p className="text-slate-500 mt-2">Le mouton peut être abattu / retiré.</p>
                            <button onClick={handleBackToList} className="mt-8 px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Client Suivant</button>
                        </div>
                    )}
                </div>
              </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-12 text-center opacity-70">
                <FiCreditCard className="text-6xl text-slate-300 mb-6" />
                <h3 className="text-xl font-bold text-slate-400">Prêt à encaisser</h3>
                <p className="text-slate-400 mt-2 max-w-sm mx-auto">Scannez le ticket du client pour finaliser son paiement.</p>
            </div>
          )}
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20"><FiX className="text-3xl" /></button>
            <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden border-4 border-indigo-500 shadow-2xl relative aspect-square"><Scanner onScan={handleScan} /></div>
        </div>
      )}
    </div>
  );
}