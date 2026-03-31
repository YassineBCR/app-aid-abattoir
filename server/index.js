import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import ovh from 'ovh';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

// --- VÉRIFICATION DES CLÉS AU DÉMARRAGE ---
console.log("--- Initialisation du serveur ---");
if (!process.env.STRIPE_SECRET_KEY) console.error("❌ ERREUR: STRIPE_SECRET_KEY manquante !");
if (!process.env.VITE_SUPABASE_URL) console.error("❌ ERREUR: SUPABASE_URL manquante !");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors());
// On garde express.json() pour toutes les routes SAUF le webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') { next(); } 
  else { express.json()(req, res, next); }
});

// ROUTE DE TEST (Tape ça dans ton navigateur : https://ton-url.onrender.com/ping)
app.get("/ping", (req, res) => res.send("Le serveur répond !"));

app.post("/create-checkout-session", async (req, res) => {
  console.log("📩 Requête reçue sur /create-checkout-session");
  const { montantTotal, panierId, description, email } = req.body;
  
  try {
    // Sécurité pour éviter le crash du .split()
    const safeId = panierId ? panierId.split('-')[0] : "Inconnu";
    console.log(`🛒 Création session pour Panier: ${safeId}, Montant: ${montantTotal}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ 
        price_data: { 
          currency: "eur", 
          product_data: { name: description || "Réservation" }, 
          unit_amount: montantTotal 
        }, 
        quantity: 1 
      }],
      mode: "payment",
      customer_email: email, 
      client_reference_id: panierId, 
      payment_intent_data: { description: `Panier #${safeId}` },
      metadata: { panier_id: panierId },
      success_url: `${FRONTEND_URL}/paiement-reussi?session_id={CHECKOUT_SESSION_ID}&panier_id=${panierId}`,
      cancel_url: `${FRONTEND_URL}/reservation`,
    });

    console.log("✅ Session Stripe créée avec succès");
    res.json({ url: session.url });
  } catch (error) {
    console.error("🔥 ERREUR CRITIQUE STRIPE:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Le reste de tes routes (webhook, etc.) va ici...
// ...

// Servir le Frontend
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`✅ Serveur live sur le port ${PORT}`); });