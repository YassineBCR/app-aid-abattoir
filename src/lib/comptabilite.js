import { supabase } from "./supabase";

/**
 * Enregistre un mouvement de comptabilité.
 * Toute la traçabilité financière passe par cette fonction.
 *
 * @param {Object} params
 * @param {'encaissement'|'annulation'|'fond_caisse'|'ajout_caisse'|'retrait_caisse'} params.type_mouvement
 * @param {number}  params.montant_cents   - positif = entrée, négatif = sortie
 * @param {'especes'|'cb'|'stripe_web'|'stripe_guichet'} params.moyen_paiement
 * @param {string}  [params.commande_id]
 * @param {number}  [params.ticket_num]
 * @param {string}  [params.caisse_id]
 * @param {string}  [params.reference_externe]  - session_id Stripe, etc.
 * @param {string}  [params.motif]              - obligatoire pour 'annulation'
 * @param {string}  [params.notes]
 * @returns {Promise<Object>}  La ligne insérée
 */
export async function enregistrerMouvement({
  type_mouvement,
  montant_cents,
  moyen_paiement,
  commande_id    = null,
  ticket_num     = null,
  caisse_id      = null,
  reference_externe = null,
  motif          = null,
  notes          = null,
}) {
  if (type_mouvement === 'annulation' && !motif) {
    throw new Error("Le motif est obligatoire pour une annulation.");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const operateur_email = user?.email ?? 'systeme@auto';

  const { data, error } = await supabase
    .from('comptabilite')
    .insert({
      type_mouvement,
      montant_cents,
      moyen_paiement,
      commande_id,
      ticket_num,
      caisse_id,
      operateur_email,
      reference_externe,
      motif,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Vérifie si une référence externe (ex: session_id Stripe)
 * a déjà été enregistrée pour éviter les doublons.
 *
 * @param {string} reference_externe
 * @returns {Promise<boolean>}
 */
export async function paiementDejaEnregistre(reference_externe) {
  if (!reference_externe) return false;
  const { data } = await supabase
    .from('comptabilite')
    .select('id')
    .eq('reference_externe', reference_externe)
    .maybeSingle();
  return !!data;
}

/**
 * Charge l'historique de paiements d'une commande.
 *
 * @param {string} commande_id
 * @returns {Promise<Array>}
 */
export async function getHistoriqueCommande(commande_id) {
  const { data, error } = await supabase
    .from('comptabilite')
    .select('*')
    .eq('commande_id', commande_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Calcule les totaux théoriques pour une caisse ouverte.
 * (utilisé au moment de la clôture)
 *
 * @param {string} caisse_id
 * @param {number} fond_initial_cents  - fond déclaré à l'ouverture
 * @returns {{ especes: number, cb: number }}  Montants en centimes
 */
export async function getTheoriqueCaisse(caisse_id, fond_initial_cents = 0) {
  const { data, error } = await supabase
    .from('comptabilite')
    .select('montant_cents, moyen_paiement')
    .eq('caisse_id', caisse_id);

  if (error) throw error;

  let especes = fond_initial_cents;
  let cb = 0;

  for (const tx of (data ?? [])) {
    if (tx.moyen_paiement === 'especes') especes += tx.montant_cents;
    if (tx.moyen_paiement === 'cb')      cb      += tx.montant_cents;
  }

  return { especes, cb };
}