import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function Vendeur() {
  // --- GESTION DES ONGLETS ---
  const [activeTab, setActiveTab] = useState("reception"); // 'reception' ou 'caisse'

  // ============================================================
  // PARTIE 1 : RÉCEPTION / INBOX (Nouvelles Commandes)
  // ============================================================
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  useEffect(() => {
    if (activeTab === "reception") {
      fetchInbox();
    } else {
      checkCaisse(); // Si on va sur l'onglet caisse, on vérifie l'état
    }
  }, [activeTab]);

  // Récupérer les commandes à traiter (En attente ou Payées mais pas encore validées)
  async function fetchInbox() {
    setLoadingInbox(true);
    const { data, error } = await supabase
      .from("commandes")
      .select(`*, creneaux_horaires ( date, heure_debut )`)
      .in("statut", ["en_attente", "paiement_recu"]) // On affiche les deux pour ne rien rater
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setInbox(data || []);
    setLoadingInbox(false);
  }

  // Action : Valider la commande
  async function validerCommande(id) {
    if (!confirm("Accepter cette réservation ?")) return;

    const { error } = await supabase
      .from("commandes")
      .update({ statut: "validee" }) // Passe en validée (disparaît de la liste)
      .eq("id", id);

    if (error) alert("Erreur : " + error.message);
    else {
      // Mise à jour locale (retirer de la liste)
      setInbox((prev) => prev.filter((c) => c.id !== id));
    }
  }

  // Action : Refuser la commande
  async function refuserCommande(id) {
    if (!confirm("Refuser et annuler cette commande ?")) return;

    const { error } = await supabase
      .from("commandes")
      .update({ statut: "refusee" })
      .eq("id", id);

    if (error) alert("Erreur : " + error.message);
    else {
      setInbox((prev) => prev.filter((c) => c.id !== id));
    }
  }


  // ============================================================
  // PARTIE 2 : CAISSE & SCAN (Ton code original)
  // ============================================================
  const [caisse, setCaisse] = useState(null);
  const [loadingCaisse, setLoadingCaisse] = useState(true);
  
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [manualSearch, setManualSearch] = useState("");

  const [showCloture, setShowCloture] = useState(false);
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCB, setReelCB] = useState("");

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
    const fond = prompt("Fond de caisse initial (en €) ?", "0");
    if (fond === null) return;
    
    const fondCents = parseFloat(fond) * 100;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("caisses_vendeurs").insert({
      vendeur_id: user.id,
      fond_caisse_initial: fondCents,
      statut: 'ouverte'
    });

    if (error) alert("Erreur ouverture: " + error.message);
    else checkCaisse();
  }

  // Charger commande (Scan/Recherche)
  async function loadCommande(idOrTicket) {
    setLoadingCmd(true);
    let query = supabase.from("commandes").select("*, creneaux_horaires(*)");

    if (idOrTicket.length > 20) query = query.eq("id", idOrTicket);
    else query = query.eq("ticket_num", idOrTicket);

    const { data, error } = await query.single();
    setLoadingCmd(false);

    if (error || !data) alert("Commande introuvable !");
    else {
      setCommande(data);
      setShowScanner(false);
    }
  }

  // Encaisser
  async function encaisser(mode) {
    if (!caisse) return alert("Erreur: Caisse fermée !");
    if (!commande) return;

    const total = commande.montant_total_cents;
    const dejaPaye = commande.acompte_cents;
    const reste = total - dejaPaye;

    if (reste > 0) {
        if (!confirm(`Confirmer encaissement de ${(reste/100).toFixed(2)} € en ${mode.toUpperCase()} ?`)) return;
        
        const { error: errEnc } = await supabase.from("encaissements").insert({
            caisse_id: caisse.id,
            commande_id: commande.id,
            montant_cents: reste,
            mode_paiement: mode
        });
        if (errEnc) return alert("Erreur encaissement: " + errEnc.message);
    }

    const { error: errCmd } = await supabase.from("commandes").update({
        statut: 'livree',
    }).eq("id", commande.id);

    if (errCmd) alert("Erreur validation commande: " + errCmd.message);
    else {
        alert("✅ Commande soldée et livrée !");
        setCommande(null);
    }
  }

  // Clôturer
  async function cloturer() {
    if (!confirm("Êtes-vous sûr de vouloir fermer la caisse pour aujourd'hui ?")) return;
    
    const { error } = await supabase.rpc("cloturer_caisse", {
        p_caisse_id: caisse.id,
        p_total_reel_especes: parseFloat(reelEspeces || 0) * 100,
        p_total_reel_cb: parseFloat(reelCB || 0) * 100,
        p_justification: "Clôture normale"
    });

    if (error) alert("Erreur clôture: " + error.message);
    else {
        alert("Caisse fermée ! Bon repos 😴");
        checkCaisse();
        setShowCloture(false);
    }
  }


  // ============================================================
  // RENDU VISUEL (INTERFACE)
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-20 safe-x">
      
      {/* 1. BARRE D'ONGLETS */}
      <div className="flex bg-white dark:bg-slate-800 rounded-xl shadow-sm p-1 mb-6 border border-gray-200 dark:border-slate-700">
        <button 
            onClick={() => setActiveTab("reception")}
            className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === "reception" 
                ? "bg-indigo-600 text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
        >
            📥 Réception ({inbox.length})
        </button>
        <button 
            onClick={() => setActiveTab("caisse")}
            className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === "caisse" 
                ? "bg-green-600 text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
        >
            📸 Prise en Charge
        </button>
      </div>


      {/* 2. CONTENU : ONGLET RÉCEPTION */}
      {activeTab === "reception" && (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center px-2">
                <h2 className="font-bold text-lg text-slate-800 dark:text-white">Nouvelles Commandes</h2>
                <button onClick={fetchInbox} className="text-blue-600 dark:text-blue-400 text-sm font-semibold">🔄 Actualiser</button>
            </div>

            {loadingInbox ? (
                <div className="text-center py-10 text-gray-400">Chargement...</div>
            ) : inbox.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-800 p-8 rounded-xl text-center shadow-sm">
                    <div className="text-4xl mb-2">✅</div>
                    <h3 className="text-green-800 dark:text-green-400 font-bold">Tout est à jour</h3>
                    <p className="text-green-600 dark:text-green-300 text-sm">Aucune commande en attente.</p>
                </div>
            ) : (
                inbox.map((cmd) => (
                    <div key={cmd.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4 rounded-xl shadow-sm space-y-3">
                        {/* Infos Haut */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">#{cmd.ticket_num}</span>
                                    {/* Badge statut */}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                        cmd.statut === 'paiement_recu' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {cmd.statut === 'paiement_recu' ? 'PAYÉ' : 'EN ATTENTE'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800 dark:text-white text-lg mt-1">{cmd.contact_last_name} {cmd.contact_first_name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{cmd.contact_phone}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-gray-400 uppercase">Acompte</div>
                                <div className="text-green-600 dark:text-green-400 font-mono font-bold text-lg">{(cmd.acompte_cents/100).toFixed(0)} €</div>
                            </div>
                        </div>

                        {/* Infos Bas */}
                        <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded-lg text-sm border border-gray-100 dark:border-slate-600">
                             <div className="flex justify-between dark:text-gray-300">
                                <span className="text-gray-500 dark:text-gray-400">Créneau:</span>
                                <span className="font-semibold">{cmd.creneaux_horaires ? `J${cmd.creneaux_horaires.date} - ${String(cmd.creneaux_horaires.heure_debut).slice(0,5)}` : "—"}</span>
                             </div>
                             <div className="flex justify-between mt-1 dark:text-gray-300">
                                <span className="text-gray-500 dark:text-gray-400">Préférence:</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{cmd.choix_categorie || "Aucune"}</span>
                             </div>
                        </div>

                        {/* Boutons Actions */}
                        <div className="flex gap-2 pt-1">
                            <button 
                                onClick={() => validerCommande(cmd.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-sm"
                            >
                                Accepter ✅
                            </button>
                            <button 
                                onClick={() => refuserCommande(cmd.id)}
                                className="flex-1 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-600 py-3 rounded-lg font-bold"
                            >
                                Refuser ❌
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}


      {/* 3. CONTENU : ONGLET PRISE EN CHARGE (Ton code original préservé) */}
      {activeTab === "caisse" && (
        <div className="animate-fade-in">
            {loadingCaisse ? <div className="p-10 text-center">Chargement caisse...</div> : !caisse ? (
                // Caisse Fermée
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center border border-gray-200 dark:border-slate-700 mt-4">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">Caisse Fermée</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Ouvrez votre caisse pour scanner et encaisser.</p>
                    <button onClick={ouvrirCaisse} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition">
                        🔓 Ouvrir ma Caisse
                    </button>
                </div>
            ) : (
                // Caisse Ouverte
                <>
                    {/* Header Info Caisse */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex justify-between items-center mb-6 border border-gray-100 dark:border-slate-700">
                        <div>
                            <div className="text-xs text-gray-400 font-bold uppercase">Ma Caisse</div>
                            <div className="text-green-600 font-bold flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Ouverte</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Fond: {(caisse.fond_caisse_initial / 100).toFixed(2)} €</div>
                        </div>
                        <button onClick={() => setShowCloture(true)} className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-lg text-sm font-bold border border-red-100 dark:border-red-800">
                            Fermer
                        </button>
                    </div>

                    {/* Scanner / Recherche */}
                    {!commande && (
                        <div className="space-y-4">
                            <button onClick={() => setShowScanner(true)} className="w-full bg-indigo-600 text-white p-8 rounded-2xl shadow-lg flex flex-col items-center gap-2 hover:bg-indigo-700 transition">
                                <span className="text-4xl">📸</span>
                                <span className="font-bold text-lg">Scanner un Client</span>
                            </button>
                            <form onSubmit={(e) => {e.preventDefault(); loadCommande(manualSearch)}} className="flex gap-2">
                                <input type="text" placeholder="N° Ticket (ex: 105)" className="flex-1 border p-3 rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={manualSearch} onChange={e => setManualSearch(e.target.value)} />
                                <button type="submit" className="bg-gray-800 text-white px-4 rounded-xl">🔎</button>
                            </form>
                        </div>
                    )}

                    {/* Scanner Camera */}
                    {showScanner && (
                        <div className="fixed inset-0 bg-black z-50 flex flex-col safe-x safe-y">
                            <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 text-white text-xl p-4 z-10">❌ Fermer</button>
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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-slate-700 mt-4">
                            <div className="bg-gray-800 dark:bg-slate-900 text-white p-4 flex justify-between items-center">
                                <span className="font-bold">Ticket #{commande.ticket_num}</span>
                                <button onClick={() => setCommande(null)} className="text-sm underline">Annuler</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{commande.contact_last_name} {commande.contact_first_name}</h2>
                                    <p className="text-gray-500 dark:text-gray-400">{commande.sacrifice_name}</p>
                                    <div className="mt-2 inline-block px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        Agneau Catégorie {commande.choix_categorie || "?"}
                                    </div>
                                </div>
                                <hr className="dark:border-slate-700" />
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 space-y-2">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Total</span><span>{(commande.montant_total_cents / 100).toFixed(2)} €</span></div>
                                    <div className="flex justify-between text-green-600 dark:text-green-400"><span>Déjà payé</span><span>- {(commande.acompte_cents / 100).toFixed(2)} €</span></div>
                                    <div className="border-t border-yellow-200 dark:border-yellow-800 pt-2 flex justify-between font-bold text-xl text-red-600 dark:text-red-400"><span>Reste à Payer</span><span>{((commande.montant_total_cents - commande.acompte_cents) / 100).toFixed(2)} €</span></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button onClick={() => encaisser('especes')} className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold flex flex-col items-center"><span>💶 Espèces</span></button>
                                    <button onClick={() => encaisser('cb')} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold flex flex-col items-center"><span>💳 Carte Bancaire</span></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Clôture */}
                    {showCloture && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm space-y-4">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Clôture de Caisse</h2>
                                <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Espèces</label><input type="number" className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white w-full p-2 rounded" value={reelEspeces} onChange={e=>setReelEspeces(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Tickets CB</label><input type="number" className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white w-full p-2 rounded" value={reelCB} onChange={e=>setReelCB(e.target.value)} /></div>
                                <div className="flex gap-2 pt-2"><button onClick={cloturer} className="flex-1 bg-red-600 text-white font-bold py-2 rounded">Valider</button><button onClick={() => setShowCloture(false)} className="flex-1 bg-gray-200 dark:bg-slate-700 dark:text-white font-bold py-2 rounded">Annuler</button></div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
      )}

    </div>
  );
}