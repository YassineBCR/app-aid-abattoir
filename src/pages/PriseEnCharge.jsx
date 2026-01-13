import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useNotification } from "../contexts/NotificationContext";
import { FiCamera, FiSearch, FiX, FiCheckCircle, FiLock, FiUnlock, FiDollarSign, FiCreditCard, FiTrendingUp } from "react-icons/fi";

export default function PriseEnCharge() {
  const { showAlert, showConfirm, showPrompt, showNotification } = useNotification();
  const [caisse, setCaisse] = useState(null);
  const [loadingCaisse, setLoadingCaisse] = useState(true);
  
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [manualSearch, setManualSearch] = useState("");

  const [showCloture, setShowCloture] = useState(false);
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCB, setReelCB] = useState("");

  useEffect(() => {
    checkCaisse();
  }, []);

  // Vérifier si caisse ouverte
  async function checkCaisse() {
    setLoadingCaisse(true);
    const { data, error } = await supabase.rpc("get_ma_caisse_ouverte");
    if (error) console.error(error);
    
    if (data && data.length > 0) setCaisse(data[0]);
    else setCaisse(null);
    setLoadingCaisse(false);
  }

  // Ouvrir caisse
  async function ouvrirCaisse() {
    const fond = await showPrompt("Fond de caisse initial (en €) ?", "0");
    if (fond === null) return;
    
    const fondCents = parseFloat(fond) * 100;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("caisses_vendeurs").insert({
      vendeur_id: user.id,
      fond_caisse_initial: fondCents,
      statut: 'ouverte'
    });

    if (error) showNotification("Erreur ouverture: " + error.message, "error");
    else {
      showNotification("Caisse ouverte avec succès", "success");
      checkCaisse();
    }
  }

  // Charger commande (Scan/Recherche)
  async function loadCommande(idOrTicket) {
    setLoadingCmd(true);
    let query = supabase.from("commandes").select("*, creneaux_horaires(*)");

    // Si c'est un UUID (long) ou un numéro court
    if (String(idOrTicket).length > 20) query = query.eq("id", idOrTicket);
    else query = query.eq("ticket_num", idOrTicket);

    const { data, error } = await query.single();
    setLoadingCmd(false);

    if (error || !data) {
      showNotification("Commande introuvable !", "error");
    } else {
      setCommande(data);
      setShowScanner(false);
    }
  }

  // Encaisser
  async function encaisser(mode) {
    if (!caisse) return showNotification("Erreur: Caisse fermée !", "error");
    if (!commande) return;

    const total = commande.montant_total_cents;
    const dejaPaye = commande.acompte_cents;
    const reste = total - dejaPaye;

    if (reste > 0) {
        const confirmed = await showConfirm(`Confirmer encaissement de ${(reste/100).toFixed(2)} € en ${mode.toUpperCase()} ?`);
        if (!confirmed) return;
        
        const { error: errEnc } = await supabase.from("encaissements").insert({
            caisse_id: caisse.id,
            commande_id: commande.id,
            montant_cents: reste,
            mode_paiement: mode
        });
        if (errEnc) return showNotification("Erreur encaissement: " + errEnc.message, "error");
    }

    const { error: errCmd } = await supabase.from("commandes").update({
        statut: 'livree',
    }).eq("id", commande.id);

    if (errCmd) {
      showNotification("Erreur validation commande: " + errCmd.message, "error");
    } else {
      showNotification("✅ Commande soldée et livrée !", "success");
      setCommande(null);
    }
  }

  // Clôturer
  async function cloturer() {
    const confirmed = await showConfirm("Êtes-vous sûr de vouloir fermer la caisse pour aujourd'hui ?");
    if (!confirmed) return;
    
    const { error } = await supabase.rpc("cloturer_caisse", {
        p_caisse_id: caisse.id,
        p_total_reel_especes: parseFloat(reelEspeces || 0) * 100,
        p_total_reel_cb: parseFloat(reelCB || 0) * 100,
        p_justification: "Clôture normale"
    });

    if (error) {
      showNotification("Erreur clôture: " + error.message, "error");
    } else {
      showNotification("Caisse fermée ! Bon repos 😴", "success");
      checkCaisse();
      setShowCloture(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-20 safe-x animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Prise en Charge
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Scanner et encaisser les commandes
          </p>
        </div>

        {loadingCaisse ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-10 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement...</p>
          </div>
        ) : !caisse ? (
          // Caisse Fermée
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <FiLock className="text-4xl text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Caisse Fermée</h2>
              <p className="text-slate-600 dark:text-slate-400">Ouvrez votre caisse pour commencer</p>
            </div>
            <button 
              onClick={ouvrirCaisse} 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
            >
              <FiUnlock className="text-xl" />
              <span>Ouvrir ma Caisse</span>
            </button>
          </div>
        ) : (
          // Caisse Ouverte
          <>
            {/* Header Info Caisse */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-800 p-4 flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase">Caisse Ouverte</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Fond initial: <span className="font-semibold">{(caisse.fond_caisse_initial / 100).toFixed(2)} €</span>
                </div>
              </div>
              <button 
                onClick={() => setShowCloture(true)} 
                className="bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                Fermer
              </button>
            </div>

            {/* Scanner / Recherche */}
            {!commande && (
              <div className="space-y-4">
                <button 
                  onClick={() => setShowScanner(true)} 
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-8 rounded-2xl shadow-lg flex flex-col items-center gap-3 transition-all duration-200"
                >
                  <FiCamera className="text-5xl" />
                  <span className="font-bold text-xl">Scanner un Client</span>
                </button>
                <div className="relative">
                  <form onSubmit={(e) => {e.preventDefault(); loadCommande(manualSearch)}} className="flex gap-2">
                    <div className="flex-1 relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input 
                        type="text" 
                        placeholder="Rechercher par N° Ticket (ex: 105)" 
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" 
                        value={manualSearch} 
                        onChange={e => setManualSearch(e.target.value)} 
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={!manualSearch.trim() || loadingCmd}
                      className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white px-6 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingCmd ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FiSearch className="text-xl" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Scanner Camera Overlay */}
            {showScanner && (
              <div className="fixed inset-0 bg-black z-50 flex flex-col safe-x safe-y">
                <button 
                  onClick={() => setShowScanner(false)} 
                  className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
                >
                  <FiX className="text-2xl" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                  <Scanner onScan={(res) => {
                    if(res && res[0]) {
                      try { loadCommande(JSON.parse(res[0].rawValue).id); } 
                      catch { loadCommande(res[0].rawValue); }
                    }
                  }} />
                </div>
              </div>
            )}

            {/* Fiche Commande à Encaisser */}
            {commande && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 text-white p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FiTrendingUp className="text-xl" />
                    <span className="font-bold text-lg">Ticket #{commande.ticket_num}</span>
                  </div>
                  <button 
                    onClick={() => setCommande(null)} 
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="text-xl" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Informations Client */}
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {commande.contact_last_name} {commande.contact_first_name}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">{commande.sacrifice_name}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                        Catégorie {commande.choix_categorie || "?"}
                      </span>
                    </div>
                  </div>

                  {/* Récapitulatif Financier */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-5 border-2 border-amber-200 dark:border-amber-800 space-y-3">
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Total commande</span>
                      <span className="font-semibold">{(commande.montant_total_cents / 100).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                      <span className="font-medium">Acompte payé</span>
                      <span className="font-semibold">- {(commande.acompte_cents / 100).toFixed(2)} €</span>
                    </div>
                    <div className="border-t-2 border-amber-300 dark:border-amber-700 pt-3 flex justify-between items-center">
                      <span className="font-bold text-lg text-slate-800 dark:text-slate-100">Reste à payer</span>
                      <span className="font-bold text-2xl text-red-600 dark:text-red-400">
                        {((commande.montant_total_cents - commande.acompte_cents) / 100).toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* Boutons de paiement */}
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => encaisser('especes')} 
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-5 rounded-xl font-bold shadow-lg transition-all duration-200 flex flex-col items-center gap-2"
                    >
                      <FiDollarSign className="text-3xl" />
                      <span>Espèces</span>
                    </button>
                    <button 
                      onClick={() => encaisser('cb')} 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-5 rounded-xl font-bold shadow-lg transition-all duration-200 flex flex-col items-center gap-2"
                    >
                      <FiCreditCard className="text-3xl" />
                      <span>Carte Bancaire</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Clôture */}
            {showCloture && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 safe-x safe-y">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Clôture de Caisse</h2>
                    <button 
                      onClick={() => setShowCloture(false)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <FiX className="text-xl text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Total Espèces (€)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" 
                        value={reelEspeces} 
                        onChange={e=>setReelEspeces(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Total Carte Bancaire (€)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" 
                        value={reelCB} 
                        onChange={e=>setReelCB(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={cloturer} 
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold py-3 rounded-xl transition-all duration-200 shadow-lg"
                    >
                      Valider
                    </button>
                    <button 
                      onClick={() => setShowCloture(false)} 
                      className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold py-3 rounded-xl transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}