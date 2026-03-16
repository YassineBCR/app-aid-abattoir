import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import ovh from 'ovh'; // <-- NOUVEL IMPORT OVH

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration Email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// --- CONFIGURATION OVH SMS ---
const ovhClient = ovh({
  endpoint: 'ovh-eu',
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY
});

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); } 
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const panierId = session.metadata.panierId; 
    const stripeRef = session.payment_intent; 
    if (panierId) {
      await supabase.rpc('valider_paiement_panier', { p_panier_id: panierId, p_stripe_ref: stripeRef });
    }
  }
  res.json({ received: true });
});

app.use(cors());
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  const { montantTotal, panierId, description, email } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "eur", product_data: { name: description }, unit_amount: montantTotal }, quantity: 1 }],
      mode: "payment",
      customer_email: email, 
      client_reference_id: panierId, 
      payment_intent_data: { description: `Panier #${panierId.split('-')[0]} - ${description}` },
      metadata: { panier_id: panierId, type_commande: "reservation_agneaux" },
      success_url: `http://localhost:5173/paiement-reussi?session_id={CHECKOUT_SESSION_ID}&panier_id=${panierId}`,
      cancel_url: `http://localhost:5173/reservation`,
    });
    res.json({ url: session.url });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post("/valider-panier", async (req, res) => {
  try {
    const { panierId, sessionId } = req.body;
    if (!panierId || !sessionId) return res.status(400).json({ error: "Manque d'informations" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const stripeRef = session.payment_intent; 
    if (session.payment_status === 'paid') {
        await supabase.rpc('valider_paiement_panier', { p_panier_id: panierId, p_stripe_ref: stripeRef });
        res.json({ success: true, stripeRef });
    } else {
        res.status(400).json({ error: "Le paiement n'est pas terminé." });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/send-custom-email", async (req, res) => {
  const { email, subject, message } = req.body;
  if (!email || !subject || !message) return res.status(400).json({ error: "Données manquantes" });
  try {
    await transporter.sendMail({
      from: `"Abattoir de Grammont" <${process.env.SMTP_USER}>`,
      to: email, subject: subject, text: message,
      html: `<p style="white-space: pre-wrap; font-family: sans-serif;">${message}</p>`,
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Erreur lors de l'envoi" }); }
});

app.post("/send-ticket-email", async (req, res) => {
  const { email, firstName, ticketNum, sacrificeName, dateCreneau, heureCreneau } = req.body;
  if (!email) return res.status(400).json({ error: "Email manquant" });
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5;">Bonjour ${firstName},</h2>
        <p>Voici le récapitulatif de votre billet pour l'Aïd.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;">Ticket N° : <strong style="font-size: 18px; color: #10b981;">#${ticketNum}</strong></p>
            <p style="margin: 5px 0;">Sacrifice pour : <strong>${sacrificeName}</strong></p>
            <p style="margin: 5px 0;">Créneau de retrait : <strong>${dateCreneau} à ${heureCreneau}</strong></p>
        </div>
        <p style="color: #64748b; font-size: 12px;">Ceci est un message automatique, merci de ne pas y répondre.</p>
      </div>
    `;
    await transporter.sendMail({
      from: `"Abattoir de Grammont" <${process.env.SMTP_USER}>`,
      to: email, subject: `Votre Billet de Réservation N°${ticketNum}`, html: htmlContent,
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Erreur serveur" }); }
});

// --- NOUVELLE ROUTE : Envoi de SMS via OVH ---
app.post("/send-sms", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: "Données manquantes" });

  try {
    // Formatage du numéro de téléphone en format international (+33...)
    let formattedPhone = phone.replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+33' + formattedPhone.slice(1);
    }

    // Si tu n'as pas activé ton nom d'expéditeur personnalisé chez OVH, 
    // commente la ligne "sender" et remplace par "senderForResponse: true"
    const result = await ovhClient.requestPromised('POST', `/sms/${process.env.OVH_SMS_ACCOUNT}/jobs`, {
      message: message,
      sender: process.env.OVH_SMS_SENDER || 'ABATTOIR', 
      receivers: [formattedPhone],
      noStopClause: true // Empêche l'ajout automatique de "STOP au XXXXX" si c'est de l'informationnel
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error("Erreur OVH SMS:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi du SMS via OVH" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`✅ Serveur démarré sur le port ${PORT}`); });