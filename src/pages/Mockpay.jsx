import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useState } from "react";
import { useNotification } from "../contexts/NotificationContext";
import { FiCreditCard, FiCheckCircle, FiXCircle, FiArrowLeft } from "react-icons/fi";

export default function MockPay() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const commandeId = params.get("commande_id");
  const ticketNum = params.get("ticket_num");

  async function onSuccess() {
    if (!commandeId) return showNotification("commande_id manquant", "error");
    setBusy(true);

    const { error } = await supabase.rpc("mock_payment_success", {
      p_commande_id: commandeId,
    });

    setBusy(false);

    if (error) {
      showNotification("Erreur mock paiement OK: " + error.message, "error");
      return;
    }

    // ✅ CORRECTION ICI : On redirige vers la page du TICKET au lieu du Dashboard
    nav(`/paiement-ok?commande_id=${commandeId}`, { replace: true });
  }

  // Fonction d'échec (inchangée, mais je la remets pour que le fichier soit complet)
  async function onFail() {
    if (!commandeId) return showNotification("commande_id manquant", "error");
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
      showNotification("Impossible d'annuler : " + error.message, "error");
      return;
    }

    showNotification("Paiement refusé. La commande a été annulée.", "warning");
    nav("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900 safe-y safe-x animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <FiCreditCard className="text-2xl text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paiement (Simulation)</h1>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 space-y-2">
          <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
            Commande : <span className="font-mono">{String(commandeId).slice(0, 8)}...</span>
          </div>
          <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
            Ticket prévu : <span className="font-bold">{ticketNum ?? "—"}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            disabled={busy}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl p-4 font-bold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={onSuccess}
          >
            <FiCheckCircle className="text-xl" />
            <span>Valider le paiement (Succès)</span>
          </button>

          <button
            disabled={busy}
            className="w-full bg-white dark:bg-slate-700 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl p-4 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={onFail}
          >
            <FiXCircle className="text-xl" />
            <span>Refuser le paiement (Échec)</span>
          </button>

          <button
            disabled={busy}
            className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-600 rounded-xl p-3 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
            onClick={() => nav("/dashboard", { replace: true })}
          >
            <FiArrowLeft className="text-base" />
            <span>Retour au menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}