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
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!commandeId || !ticketNum) { alert("Lien invalide."); navigate("/"); }
  }, [commandeId, ticketNum, navigate]);

  async function handlePaymentSuccess() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("commandes")
        .update({ statut: "acompte_paye", date_paiement: new Date() })
        .eq("id", commandeId);

      if (error) throw error;
      setStatus("success");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) { console.error(err); setStatus("error"); } finally { setLoading(false); }
  }

  async function handlePaymentFailure() { alert("Annulé."); navigate("/"); }

  if (status === "success") return (<div className="min-h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-4"><FiCheckCircle className="text-6xl mb-4" /><h1 className="text-3xl font-bold">Paiement Validé !</h1><p className="mt-2 text-lg">Ticket #{ticketNum} confirmé.</p></div>);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-200 dark:border-slate-700">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-3xl"><FiCreditCard /></div>
        <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Simulateur Paiement</h1><p className="text-slate-500 mt-2">Ticket n° <strong>{ticketNum}</strong></p></div>
        <div className="space-y-3">
          <button onClick={handlePaymentSuccess} disabled={loading} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">{loading ? <FiLoader className="animate-spin" /> : <FiCheckCircle />} Valider (Succès)</button>
          <button onClick={handlePaymentFailure} disabled={loading} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 font-bold rounded-xl transition-all">Annuler</button>
        </div>
      </div>
    </div>
  );
}