import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit'; 
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors({ origin: process.env.FRONT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// --- 1. CRÉATION DU TERMINAL DE PAIEMENT STRIPE ---
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { montant, commandeId, description } = req.body;
    if (!commandeId) return res.status(400).json({ error: "ID de commande manquant." });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { currency: 'eur', product_data: { name: description || 'Acompte Réservation' }, unit_amount: montant },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-ok?session_id={CHECKOUT_SESSION_ID}&commande_id=${commandeId}`,
      cancel_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-annule?commande_id=${commandeId}`,
    });

    res.json({ url: session.url });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 2. VÉRIFICATION DU PAIEMENT ---
app.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ status: session.payment_status });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- 3. ENVOI DU BILLET DESIGN PAR EMAIL + PDF ---
app.post('/send-ticket-email', async (req, res) => {
  try {
    const { email, firstName, ticketNum, sacrificeName, dateCreneau, heureCreneau, qrData } = req.body;

    // Couleurs du thème (Le beau vert de votre image)
    const primaryGreen = '#0d5c38'; 
    const darkText = '#1e293b';
    const grayText = '#475569';

    // 1. TÉLÉCHARGEMENT DE L'IMAGE DU QR CODE
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
    const qrResponse = await fetch(qrImageUrl);
    const qrArrayBuffer = await qrResponse.arrayBuffer();
    const qrBuffer = Buffer.from(qrArrayBuffer);

    // ==========================================
    // 2. CRÉATION DU FICHIER PDF (DESIGN EXACT)
    // ==========================================
    const doc = new PDFDocument({ size: 'A5', margin: 0 }); // A5: 419 x 595
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Fond gris très clair pour faire ressortir la carte blanche
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f1f5f9');

    // Bandeau Supérieur Vert
    doc.rect(0, 0, doc.page.width, 90).fill(primaryGreen);
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold').text('ABATTOIR GRAMMONT', 0, 25, { align: 'center', tracking: 1 });
    doc.fontSize(24).text('BILLET OFFICIEL', 0, 48, { align: 'center' });

    // Carte Blanche Centrale (Ombre simulée avec un trait gris clair)
    const cardMargin = 20;
    const cardWidth = doc.page.width - (cardMargin * 2);
    doc.roundedRect(cardMargin, 110, cardWidth, 430, 10).fill('white');
    doc.roundedRect(cardMargin, 110, cardWidth, 430, 10).lineWidth(1).stroke('#e2e8f0');

    // Numéro du ticket en gros et en vert
    doc.fillColor(primaryGreen).fontSize(42).font('Helvetica-Bold').text(`N° ${ticketNum}`, 0, 140, { align: 'center' });

    // Lignes d'informations (Alignées proprement)
    const labelX = 45;
    const valueX = 160;
    let currentY = 220;
    const lineSpacing = 35;

    // Ligne SACRIFICE
    doc.fillColor(grayText).fontSize(14).font('Helvetica').text('SACRIFICE:', labelX, currentY);
    doc.fillColor(darkText).font('Helvetica-Bold').text(sacrificeName, valueX, currentY);
    
    // Ligne DATE
    currentY += lineSpacing;
    doc.fillColor(grayText).font('Helvetica').text('DATE:', labelX, currentY);
    doc.fillColor(darkText).font('Helvetica-Bold').text(dateCreneau, valueX, currentY);

    // Ligne HEURE
    currentY += lineSpacing;
    doc.fillColor(grayText).font('Helvetica').text('HEURE:', labelX, currentY);
    doc.fillColor(darkText).font('Helvetica-Bold').text(heureCreneau, valueX, currentY);

    // QR Code (Centré avec bordure verte)
    const qrSize = 150;
    const qrX = (doc.page.width - qrSize) / 2;
    const qrY = 320;
    
    // Bordure verte autour du QR code
    doc.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 8).lineWidth(3).stroke(primaryGreen);
    // Insertion de l'image
    doc.image(qrBuffer, qrX, qrY, { width: qrSize });

    // Texte sous le QR Code
    doc.fillColor(darkText).fontSize(14).font('Helvetica').text("Scannez ce code à l'entrée", 0, qrY + qrSize + 15, { align: 'center' });

    // Pied de page tout en bas
    doc.fillColor(grayText).fontSize(10).font('Helvetica').text("Merci de votre confiance. www.abattoirgrammont.fr", 0, doc.page.height - 30, { align: 'center' });

    doc.end();

    const pdfBuffer = await new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });


    // ==========================================
    // 3. LE CORPS DE L'E-MAIL (HTML ASSORTI)
    // ==========================================
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 40px 10px; text-align: center;">
        
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          
          <div style="background-color: ${primaryGreen}; padding: 30px 20px; color: #ffffff;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 1px; opacity: 0.9;">ABATTOIR GRAMMONT</p>
            <h1 style="margin: 5px 0 0; font-size: 28px; font-weight: 900; letter-spacing: 0.5px;">BILLET OFFICIEL</h1>
          </div>

          <div style="padding: 30px 20px 10px;">
            <h2 style="margin: 0; font-size: 48px; color: ${primaryGreen}; font-weight: 900;">N° ${ticketNum}</h2>
          </div>

          <div style="padding: 20px 40px; text-align: left;">
            <table style="width: 100%; font-size: 16px; border-collapse: separate; border-spacing: 0 12px;">
              <tr>
                <td style="color: ${grayText}; text-transform: uppercase; width: 35%;">Sacrifice:</td>
                <td style="color: ${darkText}; font-weight: bold; font-size: 18px;">${sacrificeName}</td>
              </tr>
              <tr>
                <td style="color: ${grayText}; text-transform: uppercase;">Date:</td>
                <td style="color: ${darkText}; font-weight: bold; font-size: 17px; text-transform: capitalize;">${dateCreneau}</td>
              </tr>
              <tr>
                <td style="color: ${grayText}; text-transform: uppercase;">Heure:</td>
                <td style="color: ${darkText}; font-weight: bold; font-size: 17px;">${heureCreneau}</td>
              </tr>
            </table>
          </div>

          <div style="padding: 10px 20px 30px;">
            <div style="display: inline-block; padding: 5px; border: 3px solid ${primaryGreen}; border-radius: 12px;">
              <img src="${qrImageUrl}" alt="QR Code" style="width: 180px; height: 180px; display: block;" />
            </div>
            <p style="font-size: 15px; color: ${darkText}; margin: 15px 0 0;">Scannez ce code à l'entrée</p>
          </div>

        </div>

        <p style="color: ${grayText}; font-size: 12px; margin-top: 30px;">
          Merci de votre confiance. <a href="https://www.abattoirgrammont.fr" style="color: ${primaryGreen}; text-decoration: none;">www.abattoirgrammont.fr</a><br><br>
          <em>Veuillez trouver la version PDF de ce billet en pièce jointe (à imprimer ou à conserver sur votre téléphone).</em>
        </p>
      </div>
    `;

    // ==========================================
    // 4. ENVOI VIA RESEND
    // ==========================================
    const data = await resend.emails.send({
      from: 'Abattoir Grammont <contact@upyb.fr>',
      to: email,
      subject: `Votre Billet Officiel - Ticket N°${ticketNum}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Billet_Abattoir_Ticket_${ticketNum}.pdf`,
          content: pdfBuffer,
        }
      ]
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Erreur d'envoi d'email:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur démarré sur le port ${PORT}`));