import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function Vendeur() {
  // État Caisse
  const [caisse, setCaisse] = useState(null); // Si null = caisse fermée
  const [loadingCaisse, setLoadingCaisse] = useState(true);
  
  // État Scan & Commande
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  const [loadingCmd, setLoadingCmd] = useState(false);
  const [manualSearch, setManualSearch] = useState("");

  // État Clôture
  const [showCloture, setShowCloture] = useState(false);
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCB, setReelCB] = useState("");

  useEffect(() => {
    checkCaisse();
  }, []);

  // 1. VÉRIFIER SI J'AI UNE CAISSE OUVERTE
  async function checkCaisse() {
    setLoadingCaisse(true);
    const { data, error } = await supabase.rpc("get_ma_caisse_ouverte");
    if (error) console.error(error);
    
    if (data && data.length > 0) {
      setCaisse(data[0]);
    } else {
      setCaisse(null);
    }
    setLoadingCaisse(false);
  }

  // 2. OUVRIR MA CAISSE
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

  // 3. CHARGER UNE COMMANDE (Scan ou Recherche)
  async function loadCommande(idOrTicket) {
    setLoadingCmd(true);
    let query = supabase.from("commandes").select("*, creneaux_horaires(*)");

    // Si ça ressemble à un UUID (scan QR), on cherche par ID, sinon par ticket_num
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

  // 4. ENCAISSER & VALIDER (Le cœur du métier)
  async function encaisser(mode) {
    if (!caisse) return alert("Erreur: Caisse fermée !");
    if (!commande) return;

    // Calcul du reste à payer
    const total = commande.montant_total_cents; // Prix stocké (ex: 25000)
    const dejaPaye = commande.acompte_cents;   // Acompte (ex: 5000)
    const reste = total - dejaPaye;

    if (reste > 0) {
        if (!confirm(`Confirmer encaissement de ${(reste/100).toFixed(2)} € en ${mode.toUpperCase()} ?`)) return;
        
        // A. Enregistrer l'encaissement
        const { error: errEnc } = await supabase.from("encaissements").insert({
            caisse_id: caisse.id,
            commande_id: commande.id,
            montant_cents: reste,
            mode_paiement: mode
        });
        if (errEnc) return alert("Erreur encaissement: " + errEnc.message);
    }

    // B. Mettre à jour la commande (Livrée + Solde payé)
    // On met 'total_paye' au max pour dire que tout est réglé
    const { error: errCmd } = await supabase.from("commandes").update({
        statut: 'livree',
        // On pourrait mettre à jour total_paye ici si tu as une colonne pour ça
    }).eq("id", commande.id);

    if (errCmd) alert("Erreur validation commande: " + errCmd.message);
    else {
        alert("✅ Commande soldée et livrée !");
        setCommande(null); // Retour à l'accueil vendeur
    }
  }

  // 5. CLÔTURER LA CAISSE (Fin de journée)
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

  // --- RENDU VISUEL ---

  if (loadingCaisse) return <div className="p-10 text-center">Chargement caisse...</div>;

  // CAS 1 : Caisse Fermée -> On force l'ouverture
  if (!caisse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2 text-slate-800 dark:text-slate-100">Caisse Fermée</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Vous devez ouvrir votre caisse pour commencer à vendre.</p>
          <button 
            onClick={ouvrirCaisse}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition"
          >
            🔓 Ouvrir ma Caisse
          </button>
        </div>
      </div>
    );
  }

  // CAS 2 : Caisse Ouverte -> Interface Vendeur
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pb-20">
      
      {/* HEADER CAISSE */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex justify-between items-center mb-6">
        <div>
            <div className="text-xs text-gray-400 font-bold uppercase">Ma Caisse</div>
            <div className="text-green-600 font-bold">● Ouverte</div>
            <div className="text-xs text-gray-500">Fond: {(caisse.fond_caisse_initial / 100).toFixed(2)} €</div>
        </div>
        <button 
            onClick={() => setShowCloture(true)}
            className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-sm font-bold border border-red-100"
        >
            Fermer Caisse
        </button>
      </div>

      {/* CLOTURE MODAL */}
      {showCloture && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Clôture de Caisse</h2>
                  <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Espèces (Billets + Pièces)</label>
                      <input type="number" className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 w-full p-2 rounded" placeholder="0.00" value={reelEspeces} onChange={e=>setReelEspeces(e.target.value)} />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Tickets CB (TPE)</label>
                      <input type="number" className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 w-full p-2 rounded" placeholder="0.00" value={reelCB} onChange={e=>setReelCB(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-2">
                      <button onClick={cloturer} className="flex-1 bg-red-600 text-white font-bold py-2 rounded">Valider Clôture</button>
                      <button onClick={() => setShowCloture(false)} className="flex-1 bg-gray-200 dark:bg-slate-600 dark:text-slate-100 font-bold py-2 rounded">Annuler</button>
                  </div>
              </div>
          </div>
      )}

      {/* SCANNER / RECHERCHE */}
      {!commande && (
        <div className="space-y-4">
            <button 
                onClick={() => setShowScanner(true)}
                className="w-full bg-green-600 text-white p-8 rounded-2xl shadow-lg flex flex-col items-center gap-2 hover:bg-green-700"
            >
                <span className="text-4xl">📸</span>
                <span className="font-bold text-lg">Scanner Client</span>
            </button>

            <form onSubmit={(e) => {e.preventDefault(); loadCommande(manualSearch)}} className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="N° Ticket (ex: 105)" 
                    className="flex-1 border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-3 rounded-xl"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                />
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-xl">🔎</button>
            </form>
        </div>
      )}

      {/* SCANNER CAMERA */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 text-white text-xl p-4 z-10">❌ Fermer</button>
            <div className="flex-1 flex items-center justify-center">
                <Scanner onScan={(res) => {
                    if(res && res[0]) {
                        try {
                            const json = JSON.parse(res[0].rawValue);
                            loadCommande(json.id);
                        } catch {
                            // Si pas JSON, on tente le rawValue direct (si c'est juste un ID)
                            loadCommande(res[0].rawValue); 
                        }
                    }
                }} />
            </div>
        </div>
      )}

      {/* FICHE COMMANDE (ENCAISSEMENT) */}
      {commande && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-slate-700 mt-4 animate-fade-in">
              <div className="bg-gray-800 dark:bg-slate-900 text-white p-4 flex justify-between items-center">
                  <span className="font-bold">Ticket #{commande.ticket_num}</span>
                  <button onClick={() => setCommande(null)} className="text-sm underline">Annuler</button>
              </div>
              
              <div className="p-6 space-y-4">
                  <div className="text-center">
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{commande.contact_first_name} {commande.contact_last_name}</h2>
                      <p className="text-gray-500 dark:text-gray-400">{commande.sacrifice_name}</p>
                      <div className="mt-2 inline-block px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Agneau Catégorie {commande.choix_categorie || "?"}
                      </div>
                  </div>

                  <hr className="border-gray-200 dark:border-slate-700" />

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 space-y-2">
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>Total</span>
                          <span>{(commande.montant_total_cents / 100).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Déjà payé (Acompte)</span>
                          <span>- {(commande.acompte_cents / 100).toFixed(2)} €</span>
                      </div>
                      <div className="border-t border-yellow-200 dark:border-yellow-700 pt-2 flex justify-between font-bold text-xl text-red-600 dark:text-red-400">
                          <span>Reste à Payer</span>
                          <span>{((commande.montant_total_cents - commande.acompte_cents) / 100).toFixed(2)} €</span>
                      </div>
                  </div>

                  {/* Actions de paiement */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => encaisser('especes')}
                        className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold flex flex-col items-center"
                      >
                          <span>💶 Espèces</span>
                          <span className="text-xs opacity-80">Cash</span>
                      </button>
                      <button 
                        onClick={() => encaisser('cb')}
                        className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold flex flex-col items-center"
                      >
                          <span>💳 Carte Bancaire</span>
                          <span className="text-xs opacity-80">TPE</span>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}