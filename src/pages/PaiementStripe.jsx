import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiLock, FiAlertCircle, FiLoader, FiTag, FiClock } from "react-icons/fi";

export default function PaiementStripe() {
  const [searchParams] = useSearchParams();
  const [paying, setPaying] = useState(false);

  // On récupère les informations de réservation transmises dans l'URL
  const c_id = searchParams.get("c_id");
  const sacrifice_name = searchParams.get("sac");
  const heure = searchParams.get("heure");
  const acompte = 5000; // 50€

  const handlePaiement = async () => {
    setPaying(true);
    try {
      // On prépare les données pour que Stripe nous les renvoie à la fin
      const successParams = new URLSearchParams({
        c_id: searchParams.get("c_id"),
        cat: searchParams.get("cat"),
        prix: searchParams.get("prix"),
        fn: searchParams.get("fn"),
        ln: searchParams.get("ln"),
        ph: searchParams.get("ph"),
        em: searchParams.get("em"),
        sac: searchParams.get("sac"),
        reserve_now: "true" // C'est ce paramètre qui va déclencher la réservation en base
      }).toString();

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          montantTotal: acompte, 
          description: `Acompte Ticket Agneau`,
          email: searchParams.get("em"),
          successParams: successParams
        }),
      });

      const data = await response.json();
      if (data.url) window.location.href = data.url; 
      else alert("Erreur Stripe : " + data.error);
    } catch (error) {
      alert("Erreur serveur : la connexion a échoué");
    } finally {
      setPaying(false);
    }
  };

  if (!c_id) return <div className="min-h-screen flex items-center justify-center"><FiAlertCircle className="text-4xl text-red-500" /> Erreur de données</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border text-center">
        <h2 className="text-2xl font-bold mb-6">Validation du Panier</h2>
        
        <div className="bg-slate-50 p-6 rounded-2xl text-left space-y-4 mb-8">
          <div className="flex justify-between border-b pb-3">
            <span className="flex gap-2"><FiTag /> Numéro de Ticket</span>
            <span className="font-bold text-sm text-orange-500">Attribué au paiement</span>
          </div>
          <div className="flex justify-between"><span>Pour</span><span className="font-bold">{sacrifice_name}</span></div>
          <div className="flex justify-between border-b pb-3">
            <span className="flex gap-2"><FiClock /> Heure prévue</span>
            <span className="font-bold">{heure?.slice(0,5)}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="font-bold">Acompte à régler</span>
            <span className="text-2xl font-black">{(acompte / 100).toFixed(2)} €</span>
          </div>
        </div>

        <button onClick={handlePaiement} disabled={paying} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
          {paying ? <FiLoader className="animate-spin" /> : <><FiLock /> Confirmer et Payer</>}
        </button>
      </div>
    </div>
  );
}