import { supabase } from "./supabase";

/**
 * Enregistre une action dans les logs globaux pour surveillance.
 * @param {string} category - Ex: 'AUTH', 'CAISSE', 'STOCK', 'COMMANDE'
 * @param {string} action - Ex: 'CONNEXION', 'AJOUT', 'DELETE'
 * @param {string} details - Description humaine de l'action
 * @param {object} metadata - Données techniques optionnelles
 */
export async function logAction(category, action, details, metadata = {}) {
  try {
    // On essaie de récupérer l'utilisateur courant
    const { data: { user } } = await supabase.auth.getUser();
    
    // On récupère son rôle pour l'historique
    let userRole = 'inconnu';
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profile) userRole = profile.role;
    }

    // Insertion dans la table
    await supabase.from("global_logs").insert({
      user_id: user?.id || null,
      user_email: user?.email || 'Système/Anonyme',
      role: userRole,
      category: category.toUpperCase(),
      action: action.toUpperCase(),
      details: details,
      metadata: metadata
    });

  } catch (err) {
    // On affiche l'erreur en console mais on ne bloque pas l'appli
    console.error("Erreur critique Logger :", err);
  }
}