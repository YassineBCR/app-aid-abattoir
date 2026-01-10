import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../components/Ticket"; // Ton composant Ticket visuel
import emailjs from "@emailjs/browser";    // 👈 INDISPENSABLE pour le mail
import QRCode from "qrcode";               // 👈 INDISPENSABLE pour générer l'image QR du mail

// 👇 REMETS TES CLÉS ICI 👇
const SERVICE_ID = "service_qmeq26s";
const TEMPLATE_ID = "template_1r2fngu";
const PUBLIC_KEY = "M1uCyX4sX1jw1owSm";

export default function PaiementOk() {
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("Validation du paiement…");
  const [commande, setCommande] = useState(null);
  
  // Pour éviter d'envoyer le mail 2 fois (React charge parfois 2 fois les effets)
  const [emailSent, setEmailSent] = useState(false); 

  useEffect(() => {
    let mounted = true;

    (async () => {
      const commandeId = params.get("commande_id");
      if (!commandeId) {
        setMsg("Paiement reçu ✅ mais commande_id manquant. Contacte le vendeur.");
        return;
      }

      // 1. Mise à jour du statut
      const { error: updateError } = await supabase
        .from("commandes")
        .update({ statut: "paiement_recu" })
        .eq("id", commandeId);

      if (updateError) {
        console.error(updateError);
        setMsg("Erreur d'enregistrement.");
        return;
      }

      setMsg("Paiement validé avec succès ! ✅");

      // 2. Récupération des données complètes
      const { data, error: fetchError } = await supabase
        .from("commandes")
        .select(`
          *,
          creneaux_horaires (
            date,
            heure_debut,
            heure_fin
          )
        `)
        .eq("id", commandeId)
        .single();

      if (fetchError) {
        console.error("Erreur chargement ticket", fetchError);
      } else if (mounted) {
        setCommande(data);

        // 3. ENVOI DE L'EMAIL (La partie qui manquait !)
        // On vérifie qu'on n'a pas déjà envoyé et que les clés sont configurées
        if (!emailSent && SERVICE_ID !== "service_xxxxxxx") {
           sendConfirmationEmail(data);
        }
      }
    })();

    return () => { mounted = false; };
  }, [params]); // On garde uniquement params comme dépendance pour éviter les boucles

  // --- FONCTION D'ENVOI EMAIL + QR CODE ---
  const sendConfirmationEmail = async (cmd) => {
    try {
      // A. Génération du QR Code en image Base64 pour le mail
      const qrJson = JSON.stringify({
        id: cmd.id,
        ticket: cmd.ticket_num,
        nom: cmd.contact_last_name
      });
      
      // On crée l'image invisible pour l'email
      const qrImageUrl = await QRCode.toDataURL(qrJson);

      // B. Préparation des variables pour EmailJS
      const templateParams = {
        contact_first_name: cmd.contact_first_name,
        contact_last_name: cmd.contact_last_name,
        ticket_num: cmd.ticket_num,
        sacrifice_name: cmd.sacrifice_name,
        date_creneau: cmd.creneaux_horaires?.date,
        heure_creneau: cmd.creneaux_horaires?.heure_debut,
        contact_email: cmd.contact_email,
        qr_code_img: qrImageUrl // L'image est envoyée ici
      };

      // C. Envoi effectif
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      
      console.log('SUCCESS EMAIL!');
      setEmailSent(true); // On note que c'est fait
      
    } catch (err) {
      console.error('FAILED EMAIL...', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Carte de statut */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-green-700">Paiement Confirmé</h1>
          <p className="text-gray-600">{msg}</p>
          {emailSent && <p className="text-xs text-green-600 font-semibold">📧 Email de confirmation envoyé !</p>}
          
          <Link className="inline-block text-sm text-blue-600 hover:underline" to="/dashboard">
            ← Retour au tableau de bord
          </Link>
        </div>

        {/* Zone Ticket */}
        {commande ? (
          <div className="animate-fade-in">
            <Ticket commande={commande} />
          </div>
        ) : (
          <div className="text-center opacity-50 text-sm">Chargement de votre ticket...</div>
        )}

      </div>
    </div>
  );
}