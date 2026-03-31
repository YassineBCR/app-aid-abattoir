import Stripe from 'stripe';

// Vercel lira automatiquement cette clé depuis tes variables d'environnement
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { montantTotal, panierId, description, email } = req.body;
  
  // Vercel détecte l'URL de ton site automatiquement ! Plus besoin de l'écrire en dur.
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const FRONTEND_URL = `${protocol}://${req.headers.host}`;

  try {
    const safeId = panierId ? panierId.split('-')[0] : "Inconnu";
    
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

    // On renvoie l'URL à React
    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("🔥 ERREUR STRIPE:", error.message);
    res.status(500).json({ error: error.message });
  }
}