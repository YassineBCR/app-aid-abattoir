import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../components/Ticket";
import { FiCheckCircle, FiMail, FiArrowLeft, FiLoader, FiXCircle } from "react-icons/fi";

export default function PaiementOk() {
  const [searchParams] = useSearchParams();
  const [msg, setMsg] = useState("Vérification sécurisée avec la banque...");
  const [commande, setCommande] = useState(null);
  const [status, setStatus] = useState("loading");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    let mounted = true;
    const sessionId = searchParams.get("session_id");
    const commandeId = searchParams.get("commande_id");

    if (!sessionId || !commandeId) {
      setStatus("error");
      setMsg("Informations de session manquantes.");
      return;
    }

    const verifyAndValidate = async () => {
      try {
        const response = await fetch(`http://localhost:3000/verify-session/${sessionId}`);
        const sessionData = await response.json();

        if (sessionData.status === 'paid') {
          // --- LA CORRECTION EST ICI ---
          // On valide le statut ET on force la date à l'instant exact du paiement
          await supabase.from("commandes").update({ 
              statut: "acompte_paye",
              created_at: new Date().toISOString() // La date sera maintenant toujours 100% exacte !
          }).eq("id", commandeId);

          const { data: finalTicket } = await supabase.from("commandes").select("*, creneaux_horaires(date, heure_debut)").eq("id", commandeId).single();

          if (finalTicket && mounted) {
            setCommande(finalTicket);
            setStatus("success");
            setMsg("Paiement validé avec succès ! ✅");
            
            const emailAlreadySent = localStorage.getItem(`email_sent_${commandeId}`);
            if (!emailAlreadySent) {
                localStorage.setItem(`email_sent_${commandeId}`, "true");
                sendResendEmail(finalTicket, mounted);
            }
          }
        } else {
          await supabase.from("commandes").delete().eq("id", commandeId);
          if (mounted) { 
            setStatus("error"); 
            setMsg("Le paiement a été refusé. La place a été remise en stock."); 
          }
        }
      } catch (err) {
        if (mounted) { 
            setStatus("error"); 
            setMsg("Impossible de contacter le serveur de paiement."); 
        }
      }
    };

    verifyAndValidate();
    return () => { mounted = false; };
  }, [searchParams]);

  const sendResendEmail = async (cmd, mounted) => {
    try {
      const dateFormatee = new Date(cmd.creneaux_horaires?.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const qrData = JSON.stringify({ id: cmd.id, ticket: cmd.ticket_num, nom: cmd.contact_last_name });

      await fetch("http://localhost:3000/send-ticket-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: cmd.contact_email,
            firstName: cmd.contact_first_name,
            ticketNum: cmd.ticket_num,
            sacrificeName: cmd.sacrifice_name,
            dateCreneau: dateFormatee,
            heureCreneau: cmd.creneaux_horaires?.heure_debut?.slice(0,5),
            qrData: qrData
        })
      });
      if (mounted) setEmailSent(true); 
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-lg space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="text-4xl flex justify-center mb-4">
            {status === 'loading' && <FiLoader className="text-blue-500 animate-spin" />}
            {status === 'success' && <FiCheckCircle className="text-green-500" />}
            {status === 'error' && <FiXCircle className="text-red-500" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {status === 'loading' ? "Vérification..." : status === 'success' ? "Paiement Confirmé" : "Erreur Serveur"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">{msg}</p>
          
          {emailSent && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-bold mt-2">
              <FiMail className="text-base" /><span>Votre ticket a été envoyé par email !</span>
            </div>
          )}

          <Link className="inline-flex items-center gap-2 text-indigo-600 font-bold mt-4" to="/dashboard">
            <FiArrowLeft /> Retour à l'accueil
          </Link>
        </div>
        {commande && status === 'success' && <Ticket commande={commande} />}
      </div>
    </div>
  );
}