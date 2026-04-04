import ovh from 'ovh';

// Initialisation du client OVH avec les variables d'environnement
const ovhClient = ovh({
  endpoint: 'ovh-eu', // L'API OVH Europe
  appKey: process.env.OVH_APP_KEY,
  appSecret: process.env.OVH_APP_SECRET,
  consumerKey: process.env.OVH_CONSUMER_KEY
});

export default async function handler(req, res) {
  // N'accepter que les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Numéro ou message manquant' });
  }

  try {
    // 1. Formatage du numéro de téléphone pour OVH (format international)
    let cleanPhone = phone.replace(/\s/g, ''); // Enlève les espaces
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '+33' + cleanPhone.substring(1); // Remplace le 0 par +33
    }

    // 2. Récupération des infos de ton compte SMS OVH
    // Ex: sms-xx11111-1
    const smsService = process.env.OVH_SMS_SERVICE; 
    // Ex: "AID" ou ton expéditeur validé sur OVH
    const sender = process.env.OVH_SMS_SENDER;      

    if (!smsService || !sender) {
      throw new Error("Configuration OVH (Service ou Sender) manquante dans les variables d'environnement.");
    }

    // 3. Appel de l'API OVH pour envoyer le SMS
    const result = await new Promise((resolve, reject) => {
      ovhClient.request('POST', `/sms/${smsService}/jobs`, {
        message: message,
        receivers: [cleanPhone],
        sender: sender,
        priority: 'high',
        validityPeriod: 2880,
        noStopClause: true // Autorisé pour des SMS transactionnels/informatifs
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    console.log("✅ OVH SMS Envoyé avec succès :", result);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    console.error("❌ Erreur lors de l'envoi via OVH :", err);
    return res.status(500).json({ error: "Erreur lors de l'envoi du SMS via OVH", details: err.message || err });
  }
}