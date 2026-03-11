import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../components/Ticket";
import emailjs from "@emailjs/browser";
import QRCode from "qrcode";
import { FiCheckCircle, FiMail, FiArrowLeft, FiLoader, FiXCircle } from "react-icons/fi";

const SERVICE_ID = "service_qmeq26s";
const TEMPLATE_ID = "template_1r2fngu";
const PUBLIC_KEY = "M1uCyX4sX1jw1owSm";

export default function PaiementOk() {
  const [searchParams] = useSearchParams();
  const [msg, setMsg] = useState("Vérification sécurisée avec la banque...");
  const [commande, setCommande] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMsg("Aucune session de paiement détectée.");
      return;
    }

    const verifyAndValidate = async () => {
      try {
        // 1. ON DEMANDE AU SERVEUR SI LE PAIEMENT EST RÉELLEMENT PASSÉ
        const response = await fetch(`http://localhost:3000/verify-session/${sessionId}`);
        const sessionData = await response.json();

        // 2. SI C'EST PAYÉ
        if (sessionData.status === 'paid') {
          const meta = sessionData.metadata;
          
          // Sécurité Anti-Doublon : On vérifie si ce navigateur a déjà créé ce ticket
          const alreadyCreated = localStorage.getItem(`stripe_${sessionId}`);

          if (alreadyCreated) {
            // S'il a juste actualisé la page, on récupère son ticket déjà créé.
            const { data } = await supabase.from("commandes").select("*, creneaux_horaires(date, heure_debut)").eq("contact_email", meta.email).order("created_at", { ascending: false }).limit(1).single();
            if (data && mounted) { setCommande(data); setStatus("success"); setMsg("Paiement validé !"); }
          } else {
            // S'IL N'EST PAS CRÉÉ, ON LE CRÉE MAINTENANT ! (Et on retire la place)
            setStatus("loading");
            setMsg("Paiement validé ! Génération de votre ticket officiel...");

            const { data: newTicket, error } = await supabase.rpc("reserver_prochain_ticket", {
              p_creneau_id: meta.creneau_id,
              p_client_id: meta.client_id,
              p_nom: meta.nom,
              p_prenom: meta.prenom,
              p_email: meta.email,
              p_tel: meta.tel,
              p_sacrifice_name: meta.sacrifice_name,
              p_categorie: meta.categorie,
              p_montant_total_cents: parseInt(meta.montant_total),
              p_acompte_cents: parseInt(meta.acompte)
            });

            if (error) throw error;

            // On le marque directement en payé pour le Vendeur
            await supabase.from("commandes").update({ statut: "acompte_paye" }).eq("id", newTicket.commande_id);

            // On enregistre dans le navigateur pour bloquer les doublons s'il rafraîchit
            localStorage.setItem(`stripe_${sessionId}`, "true");

            // On récupère toutes les infos du ticket pour l'afficher
            const { data: finalTicket } = await supabase.from("commandes").select("*, creneaux_horaires(date, heure_debut)").eq("id", newTicket.commande_id).single();

            if (finalTicket && mounted) {
              setCommande(finalTicket);
              setStatus("success");
              setMsg("Paiement validé avec succès ! ✅");
              
              if (SERVICE_ID !== "service_xxxxxxx") {
                  const qrImageUrl = await QRCode.toDataURL(JSON.stringify({ id: finalTicket.id, ticket: finalTicket.ticket_num, nom: finalTicket.contact_last_name }));
                  emailjs.send(SERVICE_ID, TEMPLATE_ID, { contact_first_name: finalTicket.contact_first_name, contact_last_name: finalTicket.contact_last_name, ticket_num: finalTicket.ticket_num, sacrifice_name: finalTicket.sacrifice_name, date_creneau: finalTicket.creneaux_horaires?.date, contact_email: finalTicket.contact_email, qr_code_img: qrImageUrl }, PUBLIC_KEY);
              }
            }
          }
        } else {
          // Si Stripe dit que ce n'est pas payé
          if (mounted) { setStatus("error"); setMsg("Le paiement a été refusé par votre banque."); }
        }
      } catch (err) {
        if (mounted) { setStatus("error"); setMsg("Erreur de connexion."); }
      }
    };

    verifyAndValidate();
    return () => { mounted = false; };
  }, [searchParams]);

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
            {status === 'loading' ? "Vérification..." : status === 'success' ? "Paiement Confirmé" : "Erreur"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">{msg}</p>
          <Link className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mt-4" to="/dashboard">
            <FiArrowLeft /> Retour à l'accueil
          </Link>
        </div>
        {commande && status === 'success' && <Ticket commande={commande} />}
      </div>
    </div>
  );
}