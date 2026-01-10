import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

// --- CONFIGURATION ---
const PRIX_TOTAL_CENTS = 25000; // Exemple: 250.00 € prix total de la bête
// Tu pourras rendre ça dynamique plus tard selon le type de sacrifice

export default function Vendeur() {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // Liste classique (pour recherche manuelle)
  const [manualSearch, setManualSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  // --- 1. GESTION DU SCAN ---
  const handleScan = async (result) => {
    if (result) {
      // Le QR code contient souvent du texte brut, on essaie de parser le JSON
      try {
        const rawValue = result[0]?.rawValue; // Dépend de la lib, parfois result?.text
        if (!rawValue) return;

        console.log("QR Lu :", rawValue);
        const data = JSON.parse(rawValue);

        // On coupe la caméra et on charge la commande
        setShowScanner(false);
        await chargerCommande(data.id);
      } catch (e) {
        console.error("Erreur lecture QR", e);
        alert("QR Code invalide ou illisible.");
        setShowScanner(false);
      }
    }
  };

  // --- 2. CHARGEMENT COMMANDE (Scan ou Recherche) ---
  async function chargerCommande(commandeId) {
    setLoading(true);
    setScannedData(null);
    setMessage("");

    const { data, error } = await supabase
      .from("commandes")
      .select(`
        *,
        creneaux_horaires (heure_debut, heure_fin)
      `)
      .eq("id", commandeId)
      .single();

    setLoading(false);

    if (error || !data) {
      alert("Commande introuvable dans la base !");
      return;
    }

    setScannedData(data);
  }

  // --- 3. VALIDATION DU RETRAIT ---
  async function validerRetrait() {
    if (!scannedData) return;
    const confirm = window.confirm("Confirmer que le client a payé le solde et récupéré son dû ?");
    if (!confirm) return;

    setLoading(true);
    const { error } = await supabase
      .from("commandes")
      .update({ statut: "livree" }) // On passe en statut final
      .eq("id", scannedData.id);

    setLoading(false);

    if (error) {
      alert("Erreur mise à jour : " + error.message);
    } else {
      alert("✅ Retrait validé avec succès !");
      setScannedData(null); // On reset pour le suivant
    }
  }

  // --- 4. RECHERCHE MANUELLE (Fallback) ---
  async function handleManualSearch(e) {
    e.preventDefault();
    // On cherche par N° Ticket (plus simple pour l'humain)
    setLoading(true);
    const { data, error } = await supabase
      .from("commandes")
      .select("id")
      .eq("ticket_num", manualSearch)
      .single();
    
    setLoading(false);

    if (data) {
      chargerCommande(data.id);
    } else {
      alert("Aucune commande trouvée avec ce numéro de ticket.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* EN-TÊTE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Espace Vendeur / Contrôle</h1>
          <p className="text-gray-500 text-sm">Scanner les tickets à l'entrée ou à la caisse.</p>
        </div>

        {/* BOUTONS D'ACTION */}
        {!showScanner && !scannedData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowScanner(true)}
              className="bg-indigo-600 text-white p-8 rounded-2xl shadow-lg flex flex-col items-center gap-4 hover:bg-indigo-700 transition-all"
            >
              <span className="text-4xl">📸</span>
              <span className="text-xl font-bold">Scanner un QR Code</span>
            </button>

            <form onSubmit={handleManualSearch} className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-center gap-4">
              <label className="font-semibold text-gray-700">Recherche manuelle</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="N° Ticket (ex: 42)"
                  className="border rounded-xl p-3 w-full"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                />
                <button type="submit" className="bg-gray-800 text-white px-4 rounded-xl">🔍</button>
              </div>
            </form>
          </div>
        )}

        {/* ZONE CAMERA */}
        {showScanner && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative">
              <button 
                onClick={() => setShowScanner(false)}
                className="absolute top-4 right-4 z-10 bg-white/80 p-2 rounded-full font-bold"
              >
                ✖ Fermer
              </button>
              <h3 className="text-center py-4 font-bold">Visez le QR Code</h3>
              <div className="aspect-square">
                <Scanner 
                    onScan={handleScan} 
                    components={{ audio: false }} // Désactive le bip si besoin
                />
              </div>
            </div>
          </div>
        )}

        {/* FICHE COMMANDE (Après Scan) */}
        {scannedData && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-100 animate-fade-in">
            {/* Header Statut */}
            <div className={`p-4 text-center font-bold text-white ${
                scannedData.statut === 'livree' ? 'bg-gray-500' :
                scannedData.statut === 'paiement_recu' ? 'bg-green-600' :
                'bg-orange-500'
            }`}>
              STATUT : {scannedData.statut.toUpperCase().replace('_', ' ')}
            </div>

            <div className="p-6 space-y-6">
              {/* Infos Client */}
              <div className="text-center">
                <div className="text-6xl font-black text-gray-800 mb-2">{scannedData.ticket_num}</div>
                <h2 className="text-2xl font-bold">{scannedData.contact_first_name} {scannedData.contact_last_name}</h2>
                <p className="text-gray-500">{scannedData.sacrifice_name}</p>
              </div>

              <hr />

              {/* Infos Financières */}
              <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Prix Total (Estimé)</span>
                  <span>{(PRIX_TOTAL_CENTS / 100).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Acompte Versé</span>
                  <span>- {(scannedData.acompte_cents / 100).toFixed(2)} €</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-xl font-bold text-red-600">
                  <span>Reste à Payer</span>
                  <span>{((PRIX_TOTAL_CENTS - scannedData.acompte_cents) / 100).toFixed(2)} €</span>
                </div>
              </div>

              {/* Actions */}
              {scannedData.statut === "livree" ? (
                <div className="text-center p-4 bg-gray-100 rounded-xl text-gray-500 font-bold">
                  ✅ Cette commande a déjà été livrée.
                </div>
              ) : (
                <button
                  onClick={validerRetrait}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg transform active:scale-95 transition-all"
                >
                  💰 Encaisser Solde & Valider Sortie
                </button>
              )}

              <button
                onClick={() => setScannedData(null)}
                className="w-full text-gray-500 py-2 hover:underline"
              >
                Annuler / Retour
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}