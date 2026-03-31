import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiLock, FiAlertCircle, FiLoader, FiTag, FiClock } from "react-icons/fi";

export default function PaiementStripe() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const commandeId = searchParams.get("commande_id"); 
  
  const [commande, setCommande] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!commandeId) return;
    const fetchCommande = async () => {
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(date, heure_debut)").eq("id", commandeId).single();
      if (data) setCommande(data);
      setLoading(false);
    };
    fetchCommande();
  }, [commandeId]);

  const handlePaiement = async () => {
    setPaying(true);
    try {
      // SOLUTION RADICALE : On force l'URL exacte de ton serveur Render
      const response = await fetch("https://app-aid-abattoir.onrender.com/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          montant: commande.acompte_cents || 5000, 
          commandeId: commande.id,
          description: `Acompte Ticket N°${commande.ticket_num}`
        }),
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url; 
    } catch (error) {
      alert("Erreur serveur");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><FiLoader className="animate-spin text-4xl text-green-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border text-center">
        <h2 className="text-2xl font-bold mb-6">Validation du Ticket</h2>
        {!commande ? (
          <div className="text-red-600"><FiAlertCircle /> Erreur de ticket</div>
        ) : (
          <>
            <div className="bg-slate-50 p-6 rounded-2xl text-left space-y-4 mb-8">
              <div className="flex justify-between border-b pb-3">
                <span className="flex gap-2"><FiTag /> Numéro de Ticket</span>
                <span className="font-black text-xl text-green-600">{commande.ticket_num}</span>
              </div>
              <div className="flex justify-between"><span>Pour</span><span className="font-bold">{commande.sacrifice_name}</span></div>
              <div className="flex justify-between border-b pb-3">
                <span className="flex gap-2"><FiClock /> Heure</span>
                <span className="font-bold">{commande.creneaux_horaires?.heure_debut?.slice(0,5)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-bold">Acompte à régler</span>
                <span className="text-2xl font-black">{(commande.acompte_cents / 100).toFixed(2)} €</span>
              </div>
            </div>

            <button onClick={handlePaiement} disabled={paying} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
              {paying ? <FiLoader className="animate-spin" /> : <><FiLock /> Confirmer et Payer</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}