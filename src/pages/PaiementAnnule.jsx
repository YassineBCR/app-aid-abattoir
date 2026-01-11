import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

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
    <div className="min-h-screen flex items-center justify-center p-6 safe-y safe-x">
      <div className="border rounded-2xl p-6 max-w-lg w-full space-y-3">
        <h1 className="text-xl font-bold">Paiement</h1>
        <p>{msg}</p>
        <Link className="underline" to="/dashboard">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
