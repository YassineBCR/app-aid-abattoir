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
        // Note: Pense aussi à remplacer ce lien par "/api/verify-session" si ce script tourne sur Vercel !
        const response = await fetch(`http://localhost:3000/verify-session/${sessionId}`);
        const sessionData = await response.json();

        if (sessionData.status === 'paid') {
          
          // 1. On récupère les infos du ticket
          const { data: finalTicket } = await supabase.from("commandes").select("*, creneaux_horaires(date, heure_debut)").eq("id", commandeId).single();

          if (finalTicket) {
            
            // 2. ANTI-DOUBLON : On vérifie si ce paiement Stripe n'est pas DÉJÀ dans l'historique
            // (Au cas où le client rafraîchit la page web)
            const { data: existingPayment } = await supabase
              .from("historique_paiements")
              .select("id")
              .eq("reference_externe", sessionId)
              .maybeSingle();

            // 3. Si c'est un nouveau paiement, on l'ajoute à l'historique !
            if (!existingPayment) {
              await supabase.from("historique_paiements").insert({
                commande_id: commandeId,
                ticket_num: finalTicket.ticket_num,
                montant_cents: finalTicket.acompte_cents || 5000,
                moyen_paiement: 'stripe',
                encaisse_par: 'Site Web (Stripe)',
                reference_externe: sessionId // On utilise l'ID de session Stripe comme référence de sécurité
              });
            }

            // 4. On met à jour la commande principale
            // On initialise le montant_paye_cents pour que la Caisse sache que 50€ ont été donnés
            await supabase.from("commandes").update({ 
                statut: "acompte_paye",
                montant_paye_cents: finalTicket.acompte_cents || 5000,
                created_at: new Date().toISOString() 
            }).eq("id", commandeId);

            if (mounted) {
              setCommande(finalTicket);
              setStatus("success");
              setMsg("Paiement validé avec succès ! ✅");
              
              const emailAlreadySent = localStorage.getItem(`email_sent_${commandeId}`);
              if (!emailAlreadySent) {
                  localStorage.setItem(`email_sent_${commandeId}`, "true");
                  sendResendEmail(finalTicket, mounted);
              }
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
        console.error(err);
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

      // ICI : Remplacement de localhost par le lien relatif Vercel
      await fetch("/api/send-ticket-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: cmd.contact_email,
            firstName: cmd.contact_first_name,
            lastName: cmd.contact_last_name, // Correction ajoutée
            phone: cmd.contact_phone,        // Correction ajoutée
            ticketNum: cmd.ticket_num,
            sacrificeName: cmd.sacrifice_name,
            jourPassage: dateFormatee,       // Correction ajoutée (remplace dateCreneau)
            heurePassage: cmd.creneaux_horaires?.heure_debut?.slice(0,5), // Correction ajoutée (remplace heureCreneau)
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