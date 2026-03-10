import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiLock, FiAlertCircle } from "react-icons/fi";

export default function PaiementStripe() {
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const montantAPayer = 5000; // 50.00€ (en centimes)

  // On attrape l'ID de la commande envoyé dans l'URL (ex: /paiement?commande_id=123)
  const reservationId = searchParams.get("commande_id"); 

  const handlePaiement = async () => {
    if (!reservationId) {
      alert("Erreur critique : Aucun ID de réservation trouvé.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("Vous devez être connecté.");
        setLoading(false);
        return;
      }

      // ON ENVOIE L'ID AU SERVEUR
      const response = await fetch("http://localhost:3000/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          montant: montantAPayer, 
          userId: user.id,
          description: "Réservation Abattoir",
          reservationId: reservationId // On attache l'ID
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url; 
      } else {
        alert("Erreur lors de la création du lien.");
      }
    } catch (error) {
      console.error("Erreur", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 text-center">
        
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Règlement</h2>
        
        {!reservationId ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 text-sm text-left mb-6">
            <FiAlertCircle className="text-xl flex-shrink-0" />
            <p>Impossible de trouver la réservation. Veuillez recommencer depuis la page de réservation.</p>
          </div>
        ) : (
          <p className="text-slate-500 mb-8">
            Vous allez être redirigé vers l'interface de paiement sécurisée de Stripe pour régler votre acompte de {(montantAPayer / 100).toFixed(2)} €.
          </p>
        )}

        <button
          onClick={handlePaiement}
          disabled={loading || !reservationId}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <FiLock /> Payer la réservation
            </>
          )}
        </button>
        
        <div className="mt-6 flex justify-center gap-2 items-center opacity-50 grayscale">
          <span className="text-xs font-semibold">100% Sécurisé</span>
        </div>
      </div>
    </div>
  );
}