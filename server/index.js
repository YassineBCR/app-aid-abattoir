import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// --- MODIFICATION ICI : On demande à Stripe de nous renvoyer l'ID de session {CHECKOUT_SESSION_ID} ---
app.post("/create-checkout-session", async (req, res) => {
  const { montantTotal, panierId, description, email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { 
              // Le nom du produit qui apparaîtra sur la page de paiement du client
              name: description 
            },
            unit_amount: montantTotal,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      
      // Pré-remplit l'email du client sur la page Stripe
      customer_email: email, 
      
      // Référence interne pour faire le lien facilement dans les exports Stripe
      client_reference_id: panierId, 
      
      // 👉 LA MODIFICATION EST ICI :
      // Cela force Stripe à afficher "Panier #..." dans la colonne Description de ton Dashboard
      payment_intent_data: {
        description: `Panier #${panierId.split('-')[0]} - ${description}`,
      },

      // Les métadonnées invisibles pour le client, mais utiles pour toi ou des webhooks
      metadata: {
        panier_id: panierId,
        type_commande: "reservation_agneaux"
      },

      // Les URL de redirection après le paiement
      success_url: `http://localhost:5173/paiement-reussi?session_id={CHECKOUT_SESSION_ID}&panier_id=${panierId}`,
      cancel_url: `http://localhost:5173/reservation`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- NOUVELLE ROUTE : Pour récupérer la référence Stripe manuellement en local ---
app.post("/valider-panier", async (req, res) => {
  try {
    const { panierId, sessionId } = req.body;
    if (!panierId || !sessionId) return res.status(400).json({ error: "Manque d'informations" });

    // On interroge Stripe pour obtenir le "pi_XXXX" (la vraie référence de paiement)
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

app.post("/send-ticket-email", async (req, res) => {
    console.log(`Email envoyé virtuellement à ${req.body.email}`);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`✅ Serveur démarré sur le port ${PORT}`); });