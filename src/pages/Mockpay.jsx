import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useState } from "react";

export default function MockPay() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const commandeId = params.get("commande_id");
  const ticketNum = params.get("ticket_num");

  async function onSuccess() {
    if (!commandeId) return alert("commande_id manquant");
    setBusy(true);

    const { error } = await supabase.rpc("mock_payment_success", {
      p_commande_id: commandeId,
    });

    setBusy(false);

    if (error) {
      alert("Erreur mock paiement OK: " + error.message);
      return;
    }

    // ✅ CORRECTION ICI : On redirige vers la page du TICKET au lieu du Dashboard
    nav(`/paiement-ok?commande_id=${commandeId}`, { replace: true });
  }

  // Fonction d'échec (inchangée, mais je la remets pour que le fichier soit complet)
  async function onFail() {
    if (!commandeId) return alert("commande_id manquant");
    setBusy(true);

    // Tentative RPC
    let { error } = await supabase.rpc("mock_payment_fail", {
      p_commande_id: commandeId,
    });

    // Fallback manuel si RPC échoue
    if (error) {
      const { error: updateError } = await supabase
        .from("commandes")
        .update({ statut: "annulee" })
        .eq("id", commandeId);
      error = updateError;
    }

    setBusy(false);

    if (error) {
      alert("Impossible d'annuler : " + error.message);
      return;
    }

    alert("Paiement refusé. La commande a été annulée.");
    nav("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="border rounded-2xl p-6 w-full max-w-md space-y-4 bg-white shadow-lg">
        <h1 className="text-xl font-bold text-gray-800">Paiement (Simulation)</h1>

        <div className="text-sm bg-blue-50 p-3 rounded-lg text-blue-800 border border-blue-200">
          <div>Commande : <b>{String(commandeId).slice(0, 8)}...</b></div>
          <div>Ticket prévu : <b>{ticketNum ?? "—"}</b></div>
        </div>

        <button
          disabled={busy}
          className="w-full border border-green-200 bg-green-50 text-green-800 rounded-xl p-4 font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
          onClick={onSuccess}
        >
          <span>✅</span>
          <span>Valider le paiement (Succès)</span>
        </button>

        <button
          disabled={busy}
          className="w-full border border-red-200 bg-red-50 text-red-800 rounded-xl p-4 font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
          onClick={onFail}
        >
          <span>❌</span>
          <span>Refuser le paiement (Échec)</span>
        </button>

        <button
          disabled={busy}
          className="w-full border border-gray-200 text-gray-600 rounded-xl p-3 text-sm hover:bg-gray-50 transition-colors"
          onClick={() => nav("/dashboard", { replace: true })}
        >
          Annuler et retourner au menu
        </button>
      </div>
    </div>
  );
}