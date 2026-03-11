import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: process.env.FRONT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// --- 1. CRÉATION DU LIEN DE PAIEMENT (SANS TOUCHER A LA BDD) ---
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { payload } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { 
            currency: 'eur', 
            product_data: { name: 'Acompte Réservation - ' + payload.p_categorie }, 
            unit_amount: payload.p_acompte_cents 
        },
        quantity: 1,
      }],
      mode: 'payment',
      // On cache toutes les informations du client dans la session Stripe
      metadata: {
        creneau_id: payload.p_creneau_id,
        client_id: payload.p_client_id,
        nom: payload.p_nom,
        prenom: payload.p_prenom,
        email: payload.p_email,
        tel: payload.p_tel,
        sacrifice_name: payload.p_sacrifice_name,
        categorie: payload.p_categorie,
        montant_total: payload.p_montant_total_cents.toString(),
        acompte: payload.p_acompte_cents.toString()
      },
      // Redirections (L'ID de session est dans l'URL pour la vérification)
      success_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-ok?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-annule`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 2. VÉRIFICATION (L'application demande "Est-ce qu'il a payé ?") ---
app.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ status: session.payment_status, metadata: session.metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur Stripe démarré sur le port ${PORT}`));