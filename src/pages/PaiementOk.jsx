import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../components/Ticket";
import emailjs from "@emailjs/browser";
import QRCode from "qrcode";
import { FiCheckCircle, FiMail, FiArrowLeft } from "react-icons/fi";

const SERVICE_ID = "service_qmeq26s";
const TEMPLATE_ID = "template_1r2fngu";
const PUBLIC_KEY = "M1uCyX4sX1jw1owSm";

export default function PaiementOk() {
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("Validation...");
  const [commande, setCommande] = useState(null);
  const [emailSent, setEmailSent] = useState(false); 

  useEffect(() => {
    let mounted = true;
    (async () => {
      const commandeId = params.get("commande_id");
      if (!commandeId) { setMsg("Erreur ID manquant."); return; }

      const { error: updateError } = await supabase
        .from("commandes")
        .update({ statut: "acompte_paye" }) // <-- ICI
        .eq("id", commandeId);

      if (updateError) { console.error(updateError); setMsg("Erreur d'enregistrement."); return; }
      setMsg("Paiement validé avec succès ! ✅");

      const { data } = await supabase.from("commandes").select(`*, creneaux_horaires (date, heure_debut, heure_fin)`).eq("id", commandeId).single();
      if (mounted && data) {
        setCommande(data);
        if (!emailSent && SERVICE_ID !== "service_xxxxxxx") sendConfirmationEmail(data);
      }
    })();
    return () => { mounted = false; };
  }, [params]);

  const sendConfirmationEmail = async (cmd) => {
    try {
      const qrJson = JSON.stringify({ id: cmd.id, ticket: cmd.ticket_num, nom: cmd.contact_last_name });
      const qrImageUrl = await QRCode.toDataURL(qrJson);
      const templateParams = { contact_first_name: cmd.contact_first_name, contact_last_name: cmd.contact_last_name, ticket_num: cmd.ticket_num, sacrifice_name: cmd.sacrifice_name, date_creneau: cmd.creneaux_horaires?.date, heure_creneau: cmd.creneaux_horaires?.heure_debut, contact_email: cmd.contact_email, qr_code_img: qrImageUrl };
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      setEmailSent(true); 
    } catch (err) { console.error('FAILED EMAIL...', err); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-slate-900 safe-y safe-x animate-fade-in">
      <div className="w-full max-w-lg space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"><FiCheckCircle className="text-4xl text-green-600 dark:text-green-400" /></div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Paiement Confirmé</h1>
          <p className="text-slate-600 dark:text-slate-400">{msg}</p>
          {emailSent && <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 font-semibold"><FiMail className="text-base" /><span>Email envoyé !</span></div>}
          <Link className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors" to="/dashboard"><FiArrowLeft className="text-base" /><span>Retour dashboard</span></Link>
        </div>
        {commande && (<div className="animate-fade-in"><Ticket commande={commande} /></div>)}
      </div>
    </div>
  );
}