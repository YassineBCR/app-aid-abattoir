import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // 1. AJOUT ICI : récupération des variables jourPassage et heurePassage
  const { email, firstName, lastName, phone, ticketNum, sacrificeName, qrData, jourPassage, heurePassage } = req.body;

  try {
    // Génération de l'URL du QR Code via QuickChart (plus fiable pour l'affichage en boîte mail)
    const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=250&margin=2`;

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
          <td style="background-color: #10b981; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">
              Merci pour votre réservation
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding: 30px;">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <span style="font-size: 32px; font-weight: 900; color: #0f172a; padding: 10px 20px; border: 3px dashed #cbd5e1; border-radius: 8px; display: inline-block;">
                TICKET N° ${ticketNum}
              </span>
            </div>

            <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>Nom :</strong> ${lastName || 'Non renseigné'}</td></tr>
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>Prénom :</strong> ${firstName || 'Non renseigné'}</td></tr>
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>Email :</strong> ${email}</td></tr>
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>Téléphone :</strong> ${phone || 'Non renseigné'}</td></tr>
              
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>📅 Jour de passage :</strong> <span style="color: #10b981; font-weight: bold;">${jourPassage || 'Non renseigné'}</span></td></tr>
              <tr><td style="font-size: 16px; color: #334155; border-bottom: 1px solid #e2e8f0;"><strong>⏰ Heure de passage :</strong> <span style="color: #10b981; font-weight: bold;">${heurePassage || 'Non renseignée'}</span></td></tr>
              
              <tr>
                <td style="font-size: 18px; color: #10b981; text-align: center; padding-top: 15px;">
                  <strong style="color:#0f172a; font-size: 14px; text-transform: uppercase;">Sacrifice au nom de :</strong><br/>
                  <span style="font-weight: 900; font-size: 22px;">${sacrificeName}</span>
                </td>
              </tr>
            </table>

            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px;">
              <p style="margin: 0 0 10px 0; color: #065f46; font-size: 15px; font-weight: bold;">📍 Choix de votre agneau</p>
              <p style="margin: 0; color: #064e3b; font-size: 15px; line-height: 1.5;">
                Vous pouvez vous rendre à Grammont à partir du <strong>15 MAI 2026</strong> pour choisir votre agneau.<br><br>
                <strong>Adresse :</strong> 2902 Avenue Albert Einstein, 34000 Montpellier<br>
                <strong>Horaires d'ouverture :</strong><br>
                De 10h à 13h et de 15h à 19h, tous les jours.
              </p>
            </div>

            <div style="text-align: center; margin-bottom: 30px;">
              <p style="font-size: 14px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Votre code d'accès</p>
              
              <img src="${qrImageUrl}" alt="QR Code Ticket" width="250" height="250" style="border: 4px solid #f1f5f9; border-radius: 12px; display: inline-block;" />
              
              <div style="margin-top: 15px;">
                <a href="${qrImageUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                  📥 Télécharger le QR Code
                </a>
              </div>
            </div>

            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 20px;">
              <h3 style="color: #e11d48; margin-top: 0; font-size: 16px; text-transform: uppercase; margin-bottom: 15px;">⚠️ Informations importantes</h3>
              
              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>En cas de retard ?</strong></p>
              <p style="margin: 0 0 15px 0; color: #881337; font-size: 13px; line-height: 1.4;">Les horaires de passage sont donnés à titre indicatif et nous ne pouvons nous tenir responsables en cas de retard lors du sacrifice.</p>
              
              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>En cas d'absence ?</strong></p>
              <p style="margin: 0 0 15px 0; color: #881337; font-size: 13px; line-height: 1.4;">En cas d'absence lors du sacrifice, il devra être effectué en votre absence et nous ne pouvons nous tenir responsables.</p>
              
              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>En cas de saisie ?</strong></p>
              <p style="margin: 0 0 15px 0; color: #881337; font-size: 13px; line-height: 1.4;">En cas de saisies par les services vétérinaires :<br>
              - Lors d'une saisie partielle (cœur, foie, abats, etc...) : Aucun remboursement ni dédommagement ne pourra être demandé.<br>
              - En cas de saisie totale : Un remplacement à l'identique sera proposé, aucun remboursement ne pourra être demandé.</p>
              
              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>En cas d'annulation ?</strong></p>
              <p style="margin: 0 0 15px 0; color: #881337; font-size: 13px; line-height: 1.4;">Aucun remboursement ne pourra être effectué.</p>
              
              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>Après le bouclage de l'agneau ?</strong></p>
              <p style="margin: 0 0 15px 0; color: #881337; font-size: 13px; line-height: 1.4;">Aucun échange ou modification ne pourra être effectué.</p>

              <p style="margin: 0 0 5px 0; color: #9f1239; font-size: 13px;"><strong>Transport de la carcasse :</strong></p>
              <p style="margin: 0; color: #881337; font-size: 13px; line-height: 1.4;"><strong>Les sacs poubelle sont strictement interdits</strong> pour le transport de la carcasse. Prévoyez un drap ou un tissu propre le jour de l'Aïd.</p>
            </div>

          </td>
        </tr>
      </table>
      
    </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Billetterie Grammont <contact@aidmontpellier.fr>',
      to: [email],
      subject: `Confirmation Réservation Ticket #${ticketNum}`,
      html: emailHtml,
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