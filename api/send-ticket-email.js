import { Resend } from 'resend';
import QRCode from 'qrcode';

// Vercel lira automatiquement process.env.RESEND_API_KEY depuis vos réglages
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Sécurité : On s'assure que c'est bien une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { email, firstName, ticketNum, sacrificeName, dateCreneau, heureCreneau, qrData } = req.body;

  try {
    // 1. Génération du QR Code en image Base64
    const qrImageBase64 = await QRCode.toDataURL(qrData, {
      width: 250,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // 2. Envoi de l'email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Billetterie Grammont <billetterie@votre-domaine.com>', // ⚠️ REMPLACEZ PAR VOTRE DOMAINE VÉRIFIÉ SUR RESEND
      to: [email],
      subject: `🎟️ Confirmation de votre Ticket #${ticketNum}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #10b981; text-align: center;">Paiement Validé !</h2>
          <p>Bonjour <strong>${firstName}</strong>,</p>
          <p>Merci pour votre commande. Votre ticket <strong>#${ticketNum}</strong> pour le sacrifice de <strong>${sacrificeName}</strong> est officiellement réservé.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📅 Retrait prévu le :</strong> ${dateCreneau} à ${heureCreneau}</p>
          </div>

          <p style="text-align: center;">Veuillez présenter ce QR Code lors de votre venue :</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrImageBase64}" alt="QR Code Ticket" style="border: 2px solid #e2e8f0; border-radius: 8px;" />
          </div>
          
          <p style="color: #64748b; font-size: 14px; text-align: center;">À très bientôt !</p>
        </div>
      `,
    });

    if (error) {
      console.error("Erreur Resend:", error);
      return res.status(400).json({ error });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Erreur serveur Vercel:", err);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
}