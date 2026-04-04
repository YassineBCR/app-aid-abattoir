export default async function handler(req, res) {
  // Accepter uniquement les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Numéro ou message manquant' });
  }

  try {
    // --- ICI TU METTRAS L'APPEL RÉEL À L'API OVH PLUS TARD ---
    // Pour le moment, on simule la réussite pour que ton application frontend fonctionne.
    console.log(`📱 Envoi SMS à ${phone} : ${message}`);
    
    // Simulation d'une attente d'API de 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    // Si tu as OVH configuré, c'est ici qu'on fera le ovh.request('POST', '/sms/...
    // ...

    return res.status(200).json({ success: true, message: "SMS envoyé avec succès" });
  } catch (err) {
    console.error("Erreur serveur SMS:", err);
    return res.status(500).json({ error: "Erreur lors de l'envoi du SMS" });
  }
}