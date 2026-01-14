import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiCheckCircle, FiXCircle, FiLoader, FiCreditCard } from "react-icons/fi";

export default function MockPay() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const commandeId = searchParams.get("commande_id");
  const ticketNum = searchParams.get("ticket_num");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, success, error

  // Vérifier si les paramètres sont là
  useEffect(() => {
    if (!commandeId || !ticketNum) {
      alert("Lien de paiement invalide (manque ID ou Ticket).");
      navigate("/");
    }
  }, [commandeId, ticketNum, navigate]);

  async function handlePaymentSuccess() {
    setLoading(true);
    try {
      // C'EST ICI LA CORRECTION :
      // On met le statut 'acompte_paye' qui est autorisé par la base de données.
      // (Avant vous aviez peut-être 'paiement_recu' qui est interdit maintenant)
      
      const { error } = await supabase
        .from("commandes")
        .update({ 
            statut: "acompte_paye",
            // On peut aussi enregistrer la date de paiement si vous avez une colonne pour ça
            // date_paiement: new Date() 
        })
        .eq("id", commandeId);

      if (error) throw error;

      setStatus("success");
      
      // Redirection automatique après 2 secondes
      setTimeout(() => {
        navigate("/client/dashboard"); // Ou une page de succès
      }, 2000);

    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentFailure() {
    // En cas d'échec, on peut soit annuler la commande (libérer le ticket), soit ne rien faire
    // Pour l'instant, on redirige juste
    alert("Paiement annulé. Le ticket reste réservé 15 min.");
    navigate("/");
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-4">
        <FiCheckCircle className="text-6xl mb-4" />
        <h1 className="text-3xl font-bold">Paiement Validé !</h1>
        <p className="mt-2 text-lg">Votre ticket #{ticketNum} est confirmé.</p>
        <p className="text-sm mt-4 opacity-75">Redirection en cours...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-200 dark:border-slate-700">
        
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-3xl">
          <FiCreditCard />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Simulateur Paiement</h1>
          <p className="text-slate-500 mt-2">
            Ticket n° <strong>{ticketNum}</strong>
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{commandeId}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between text-sm mb-2 text-slate-600 dark:text-slate-400">
            <span>Acompte à régler :</span>
            <span className="font-bold">50.00 €</span>
          </div>
          <div className="text-xs text-left text-slate-400 italic">
            Ceci est une page de test (Stripe Mock). Aucune carte réelle ne sera débitée.
          </div>
        </div>

        {status === "error" && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
            <FiXCircle /> Erreur lors de la validation.
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handlePaymentSuccess}
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
            Valider le Paiement (Succès)
          </button>

          <button
            onClick={handlePaymentFailure}
            disabled={loading}
            className="w-full py-3 bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 font-bold rounded-xl transition-all"
          >
            Simuler un Échec / Annuler
          </button>
        </div>

      </div>
    </div>
  );
}