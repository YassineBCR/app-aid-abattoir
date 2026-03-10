import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- 1. WEBHOOK STRIPE (Validation de la place) ---
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Erreur Webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Si le paiement est validé par la banque
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // On récupère l'ID caché
    const reservationId = session.metadata.reservationId;
    const stripeSessionId = session.id;

    console.log(`✅ Paiement reçu pour la réservation : ${reservationId}`);

    // Mettre à jour la transaction
    await supabase
      .from('transactions')
      .update({ statut: 'reussi' })
      .eq('stripe_payment_intent_id', stripeSessionId);

    // Valider la réservation et bloquer la place définitivement
    if (reservationId) {
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          statut: 'confirmee_payee', 
          stripe_session_id: stripeSessionId 
        })
        .eq('id', reservationId);

      if (resError) console.error("Erreur mise à jour réservation:", resError);
    }
  }

  res.json({ received: true });
});

// Autoriser le front-end à communiquer avec le serveur
app.use(cors({ origin: process.env.FRONT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// --- 2. CRÉATION DU LIEN DE PAIEMENT STRIPE ---
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { montant, userId, description, reservationId } = req.body;

    if (!reservationId) throw new Error("ID de réservation manquant.");

    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: description || 'Réservation Abattoir' },
            unit_amount: montant, // en centimes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Cacher l'ID pour le webhook
      metadata: { 
        userId: userId,
        reservationId: reservationId 
      },
      success_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-ok?session_id={CHECKOUT_SESSION_ID}`,
      
      // --- LA CORRECTION EST ICI ---
      // On attache l'ID de réservation à l'URL d'annulation
      cancel_url: `${process.env.FRONT_ORIGIN || "http://localhost:5173"}/paiement-annule?commande_id=${reservationId}`,
    });

    // Créer la trace dans Supabase "en_attente"
    await supabase.from('transactions').insert([{
      user_id: userId,
      montant: montant,
      stripe_payment_intent_id: session.id,
      description: description,
      statut: 'en_attente'
    }]);

    // Renvoyer l'URL au front-end
    res.json({ url: session.url });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur Stripe démarré sur le port ${PORT}`));