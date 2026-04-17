import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { montantTotal, panierId, description, email, successParams } = req.body;
  
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const FRONTEND_URL = `${protocol}://${req.headers.host}`;

  try {
    let success_url = `${FRONTEND_URL}/paiement-reussi?session_id={CHECKOUT_SESSION_ID}`;
    
    // Si on vient de la nouvelle méthode on ajoute les infos de reservation
    if (successParams) {
        success_url += `&${successParams}`;
    } else if (panierId) {
        success_url += `&panier_id=${panierId}`;
    }

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
      client_reference_id: panierId || "NOUVELLE_RESA", 
      payment_intent_data: { description: description || "Acompte Agneau" },
      success_url: success_url,
      cancel_url: `${FRONTEND_URL}/reservation`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("🔥 ERREUR STRIPE:", error.message);
    res.status(500).json({ error: error.message });
  }
}