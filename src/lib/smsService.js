import { supabase } from "./supabase";

/**
 * Simule l'envoi d'un SMS via OVH
 * @param {string} telephone - Numéro du destinataire (ex: "0612345678")
 * @param {string} message - Contenu du message
 * @param {string} type - 'confirmation', 'ticket', 'campagne'
 */
export async function sendSms(telephone, message, type = "campagne") {
  console.log(`📡 [SIMULATION OVH] Envoi SMS à ${telephone} : "${message}"`);

  // 1. Simulation d'un délai réseau (comme une vraie API)
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 2. On nettoie le numéro (pour le format international plus tard)
  const cleanPhone = telephone.replace(/\s/g, '').replace(/^0/, '+33');

  // 3. Enregistrement dans la base de données (Historique)
  const { data: user } = await supabase.auth.getUser();
  
  const { error } = await supabase.from("sms_logs").insert({
    destinataire: cleanPhone,
    message: message,
    type: type,
    statut: "envoye", // On part du principe que ça marche en simulation
    sent_by: user?.data?.user?.id || null
  });

  if (error) {
    console.error("Erreur log SMS:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}