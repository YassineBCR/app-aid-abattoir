import { Resend } from 'resend';

// Initialise Resend avec la même clé d'API que pour tes tickets
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // On récupère les données envoyées depuis Tableau.jsx
  const { email, subject, message, firstName, lastName } = req.body;

  try {
    // Template HTML pour le mail customisé depuis le dashboard
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px;">
      
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color: #0f172a; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px;">
              ${subject}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; font-size: 16px; color: #334155; line-height: 1.6;">
            <p>Bonjour ${firstName || ''} ${lastName || ''},</p>
            <p style="white-space: pre-wrap;">${message}</p>
            <br>
            <p style="margin-top: 30px;">
              Cordialement,<br>
              <strong>Billetterie Grammont</strong>
            </p>
          </td>
        </tr>
      </table>
      
    </body>
    </html>
    `;

    // Envoi de l'e-mail via Resend
    const { data, error } = await resend.emails.send({
      from: 'Billetterie Grammont <contact@aidmontpellier.fr>', // Assure-toi que cette adresse est vérifiée sur ton compte Resend
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    if (error) {
      console.error("Erreur Resend lors de l'envoi du mail custom:", error);
      return res.status(400).json({ error });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Erreur serveur Vercel:", err);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
  }
}