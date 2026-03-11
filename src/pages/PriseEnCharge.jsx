import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  FiSearch, FiCheckCircle, FiCamera, FiX, FiArrowRight, 
  FiList, FiArrowLeft, FiTag, FiUser, FiCreditCard, FiDollarSign, FiFileText, FiClock
} from "react-icons/fi";

export default function PriseEnCharge() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  
  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  
  const [commande, setCommande] = useState(null);
  const [searchResults, setSearchResults] = useState([]); 
  
  const [numeroBoucle, setNumeroBoucle] = useState("");
  const [montantEncaisse, setMontantEncaisse] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [loadingValidation, setLoadingValidation] = useState(false);

  // Recherche
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

  const selectCommande = (cmd) => { 
      setCommande(cmd); 
      setSearchInput(cmd.ticket_num?.toString() || ""); 
      
      // On affiche la boucle actuelle (ou vide si rien)
      setNumeroBoucle(cmd.numero_boucle || "");
      
      // Le montant encaisse reste vide par défaut. C'est au vendeur de le remplir s'il encaisse.
      setMontantEncaisse(""); 
  };
  
  const handleBackToList = () => { setCommande(null); setSearchInput(""); setNumeroBoucle(""); setMontantEncaisse(""); };

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
      if (data) { selectCommande(data); setShowScanner(false); } 
      else { showNotification("Commande introuvable par ID.", "error"); }
      setLoading(false);
  }

  // VALIDATION STRICTE (Uniquement si changement réel)
  const validerDossier = async (e) => {
      e.preventDefault();
      
      const montantAsaisi = parseFloat(montantEncaisse) || 0;
      const boucleAchange = numeroBoucle.trim() !== (commande.numero_boucle || "");

      // Sécurité : On ne fait rien si aucun champ n'a été touché
      if (montantAsaisi <= 0 && !boucleAchange) {
          return showNotification("Veuillez saisir un encaissement ou un numéro de boucle.", "info");
      }

      setLoadingValidation(true);
      try {
          // 1. Mise à jour de la boucle uniquement si elle a été modifiée
          if (boucleAchange) {
              await supabase.from('commandes').update({ numero_boucle: numeroBoucle.trim() }).eq('id', commande.id);
          }

          // 2. Encaissement strict
          let nouveauTotalPaye = dejaPaye;
          if (montantAsaisi > 0) {
              const { error: errPaiement } = await supabase.rpc("ajouter_encaissement", { 
                  p_commande_id: commande.id, 
                  p_montant: montantAsaisi, 
                  p_moyen: modePaiement, 
                  p_reference: "Guichet" 
              });
              if (errPaiement) throw errPaiement;
              nouveauTotalPaye += montantAsaisi;
          }

          // 3. Calcul du nouveau statut
          let nouveauStatut = commande.statut;
          
          if (nouveauTotalPaye >= total - 0.05) {
              nouveauStatut = 'paye_integralement'; // Si 100% payé = Clôturé
          } else if (numeroBoucle.trim() || commande.numero_boucle) {
              nouveauStatut = 'en_attente_caisse'; // Si boucle présente mais pas tout payé = En cours
          }

          // On met à jour le statut uniquement s'il a changé
          if (nouveauStatut !== commande.statut) {
             await supabase.from('commandes').update({ statut: nouveauStatut }).eq('id', commande.id);
          }

          showNotification(nouveauStatut === 'paye_integralement' ? "Dossier Clôturé !" : "Action enregistrée.", "success");
          
          // On rafraîchit les infos
          const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
          if(data) selectCommande(data);

      } catch (err) {
          showNotification("Erreur lors de l'enregistrement.", "error");
          console.error(err);
      } finally {
          setLoadingValidation(false);
      }
  };

  // CALCULS POUR L'AFFICHAGE
  const total = commande ? (commande.montant_total_cents / 100) : 0;
  const dejaPaye = commande ? ((commande.montant_paye_cents || commande.acompte_cents) / 100) : 0;
  const resteAPayer = Math.max(0, total - dejaPaye);
  
  const isTermine = resteAPayer < 0.05 && commande?.numero_boucle;

  // Sécurité pour le bouton (Grisé si aucune modification en cours)
  const isActionReady = (parseFloat(montantEncaisse) > 0) || (numeroBoucle.trim() !== (commande?.numero_boucle || ""));

  const getPaymentIcon = (moyen) => {
      switch(moyen) { case 'especes': return <FiDollarSign />; case 'cb': return <FiCreditCard />; default: return <FiFileText />; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
             <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-500/30"><FiCheckCircle className="text-2xl" /></div>
             Guichet Unique
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Recherchez un client, attribuez la boucle, et encaissez le solde restant.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
              <div className="p-5 space-y-4">
                <button 
                    onClick={() => setShowScanner(true)}
                    className="group w-full py-5 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all"
                >
                    <div className="bg-white/20 p-2 rounded-full"><FiCamera className="text-2xl" /></div>
                    <span className="font-bold text-lg tracking-wide">Scanner le QR Code</span>
                </button>

                <div className="relative group">
                    <form onSubmit={(e) => handleSearch(e)} className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <FiSearch className="text-slate-400 text-xl" />
                        </div>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="N° Ticket, Nom ou Tél..."
                            className="block w-full pl-12 pr-16 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
                        />
                        <button type="submit" disabled={loading || !searchInput} className="absolute right-2 top-2 bottom-2 aspect-square bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSearch className="text-xl" />}
                        </button>
                    </form>
                </div>
              </div>
          </div>

          {!commande && searchResults.length > 0 && (
             <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden"> 
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-emerald-800">
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"><FiList /> Résultats ({searchResults.length})</h3>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {searchResults.map(res => (
                        <button key={res.id} onClick={() => selectCommande(res)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center group">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-sm font-bold">#{res.ticket_num}</span>
                                </div>
                                <div className="text-sm font-medium text-slate-800 dark:text-white mt-1">{res.contact_last_name} {res.contact_first_name}</div>
                            </div>
                            <FiArrowRight className="text-slate-300 group-hover:text-emerald-500 text-xl" />
                        </button>
                    ))}
                </div>
             </div>
          )}
        </div>

        <div className="xl:col-span-2">
          {commande ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBackToList} className="p-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-emerald-600 rounded-lg shadow-sm border border-slate-200 transition-all"><FiArrowLeft className="text-lg" /></button>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xl">Dossier N°{commande.ticket_num}</h3>
                    </div>
                    {isTermine ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1"><FiCheckCircle /> Clôturé</span>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"><FiClock /> En cours</span>
                    )}
                </div>
                
                <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
                    <div className="lg:w-1/3 space-y-6">
                        <div className="text-center lg:text-left">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3 text-2xl text-slate-400"><FiUser /></div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{commande.contact_last_name} {commande.contact_first_name}</h2>
                            <p className="text-slate-500 text-sm mt-1">{commande.contact_phone}</p>
                            <span className="mt-3 inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">Sacrifice: {commande.sacrifice_name}</span>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-6 space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Prix Total</span><span className="font-bold">{total.toFixed(2)} €</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Total Payé</span><span className="font-bold text-teal-600">- {dejaPaye.toFixed(2)} €</span></div>
                            <div className="flex justify-between text-base pt-2 border-t border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-700 dark:text-slate-300">Reste à payer</span><span className={`font-black ${resteAPayer < 0.05 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{resteAPayer < 0.05 ? "0.00 €" : `${resteAPayer.toFixed(2)} €`}</span></div>
                        </div>
                    </div>

                    <div className="lg:w-2/3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                        {isTermine ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-8">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4"><FiCheckCircle className="text-4xl" /></div>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Dossier Soldé</h3>
                                <p className="text-slate-500 mt-2">Boucle : <strong className="text-emerald-600">{commande.numero_boucle}</strong></p>
                                <p className="text-slate-500">Le client est à jour.</p>
                                <button onClick={handleBackToList} className="mt-6 px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-50">Dossier Suivant</button>
                            </div>
                        ) : (
                            <form onSubmit={validerDossier} className="space-y-6">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"><FiTag className="text-emerald-500" /> Numéro de Boucle</label>
                                    <input 
                                        type="text" 
                                        value={numeroBoucle}
                                        onChange={(e) => setNumeroBoucle(e.target.value)}
                                        placeholder="Ex: FR-12345 (Ou vide)"
                                        className="w-full text-xl font-bold p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-emerald-500 outline-none text-slate-900 dark:text-white"
                                    />
                                </div>

                                {resteAPayer > 0 && (
                                    <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"><FiCreditCard className="text-indigo-500" /> Nouvel Encaissement</label>
                                        
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            {['especes', 'cb', 'cheque'].map(mode => (
                                                <button key={mode} type="button" onClick={() => setModePaiement(mode)} className={`py-3 px-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${modePaiement === mode ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                                                    <div className="text-xl">{getPaymentIcon(mode)}</div><span className="text-xs font-bold uppercase">{mode === 'cb' ? 'Carte' : mode}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-slate-400 font-bold">€</span></div>
                                            <input type="number" step="0.01" value={montantEncaisse} onChange={(e) => setMontantEncaisse(e.target.value)} className="block w-full pl-10 pr-24 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 rounded-xl text-xl font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="0.00" />
                                            <button type="button" onClick={() => setMontantEncaisse(resteAPayer.toFixed(2))} className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-100">Solde Max</button>
                                        </div>
                                    </div>
                                )}

                                <button 
                                  type="submit" 
                                  disabled={loadingValidation || !isActionReady} 
                                  className={`w-full py-4 mt-4 font-bold rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all ${isActionReady ? "bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                                >
                                    {loadingValidation ? "Traitement..." : <>Enregistrer l'action <FiCheckCircle /></>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-12 text-center opacity-70">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-500"><FiCheckCircle className="text-5xl" /></div>
                <h3 className="text-xl font-bold text-slate-400">Guichet prêt</h3>
                <p className="text-slate-400 mt-2 max-w-sm mx-auto">Cherchez un ticket pour mettre à jour sa boucle ou encaisser une somme.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}