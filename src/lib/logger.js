import { supabase } from "./supabase";

/**
 * Fonction universelle pour enregistrer une action dans la base de données.
 * @param {string} actionType - Le type d'action (ex: 'CREATION', 'MODIFICATION', 'SUPPRESSION', 'EXPORT')
 * @param {string} entityType - L'élément touché (ex: 'COMMANDE', 'CAISSE', 'STOCK', 'SYSTEME')
 * @param {object} details - Objet contenant les détails de l'action (ex: { ticket: 123, montant: 50 })
 */
export const logAction = async (actionType, entityType, details = {}) => {
  try {
    // 1. On récupère l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email || 'Système / Anonyme';

    // 2. On insère la ligne dans la table action_logs
    const { error } = await supabase.from('action_logs').insert({
      user_email: userEmail,
      action_type: actionType.toUpperCase(),
      entity_type: entityType.toUpperCase(),
      details: details
    });

    if (error) throw error;
  } catch (err) {
    console.error("Erreur du Logger Interne :", err);
  }
};