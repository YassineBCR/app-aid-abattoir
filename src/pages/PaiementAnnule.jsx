import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiXCircle, FiArrowLeft } from "react-icons/fi";

export default function PaiementAnnule() {
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("Paiement annulé. Libération de la réservation…");

  useEffect(() => {
    (async () => {
      const commandeId = params.get("commande_id");
      if (!commandeId) {
        setMsg("Paiement annulé. (commande_id manquant) — contacte le vendeur si besoin.");
        return;
      }

      // rollback DB (libérer ticket/place)
      const { error } = await supabase.rpc("cancel_commande", { p_commande_id: commandeId });
      if (error) {
        console.error(error);
        setMsg("Paiement annulé. Impossible de libérer automatiquement — contacte le vendeur.");
        return;
      }

      setMsg("Paiement annulé. Réservation libérée ✅");
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900 safe-y safe-x animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-lg w-full space-y-5 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <FiXCircle className="text-4xl text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Paiement Annulé</h1>
        <p className="text-slate-600 dark:text-slate-400">{msg}</p>
        <Link 
          className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors" 
          to="/dashboard"
        >
          <FiArrowLeft className="text-base" />
          <span>Retour au dashboard</span>
        </Link>
      </div>
    </div>
  );
}
