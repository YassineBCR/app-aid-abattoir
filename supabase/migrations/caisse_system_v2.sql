-- ================================================================
-- MIGRATION : Système de caisse renforcé v2
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor → New query)
-- ================================================================

-- =====================================================
-- 1. TABLE caisses_vendeurs
-- =====================================================
CREATE TABLE IF NOT EXISTS caisses_vendeurs (
  id                             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at                     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  vendeur_email                  TEXT        NOT NULL,
  fond_caisse_initial_cents      INTEGER     NOT NULL DEFAULT 0,
  statut                         TEXT        NOT NULL DEFAULT 'ouverte'
                                             CHECK (statut IN ('ouverte', 'cloturee')),
  total_theorique_especes_cents  INTEGER,
  total_theorique_cb_cents       INTEGER,
  total_reel_especes_cents       INTEGER,
  total_reel_cb_cents            INTEGER,
  ecart_especes_cents            INTEGER,
  ecart_cb_cents                 INTEGER,
  justification_ecart            TEXT,
  heure_cloture                  TIMESTAMPTZ,
  notes                          TEXT
);

-- Ajouter colonnes manquantes si la table existe déjà
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='fond_caisse_initial_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN fond_caisse_initial_cents INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='heure_cloture') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN heure_cloture TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='total_theorique_especes_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN total_theorique_especes_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='total_theorique_cb_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN total_theorique_cb_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='total_reel_especes_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN total_reel_especes_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='total_reel_cb_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN total_reel_cb_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='ecart_especes_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN ecart_especes_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='ecart_cb_cents') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN ecart_cb_cents INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='caisses_vendeurs' AND column_name='justification_ecart') THEN
    ALTER TABLE caisses_vendeurs ADD COLUMN justification_ecart TEXT;
  END IF;
END $$;

-- =====================================================
-- 2. TABLE comptabilite
-- =====================================================
CREATE TABLE IF NOT EXISTS comptabilite (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  type_mouvement     TEXT        NOT NULL
                     CHECK (type_mouvement IN ('encaissement','annulation','fond_caisse','ajout_caisse','retrait_caisse')),
  montant_cents      INTEGER     NOT NULL,
  moyen_paiement     TEXT        NOT NULL
                     CHECK (moyen_paiement IN ('especes','cb','stripe_web','stripe_guichet')),
  commande_id        UUID,
  ticket_num         INTEGER,
  caisse_id          UUID        REFERENCES caisses_vendeurs(id) ON DELETE SET NULL,
  operateur_email    TEXT        NOT NULL,
  reference_externe  TEXT,
  motif              TEXT,
  notes              TEXT
);

-- Contrainte d'unicité sur reference_externe (anti-doublons Stripe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_comptabilite_reference_externe'
  ) THEN
    ALTER TABLE comptabilite
    ADD CONSTRAINT uq_comptabilite_reference_externe
    UNIQUE (reference_externe);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- 3. TABLE comptages_caisse (NOUVELLE)
-- Enregistre chaque comptage admin d'une caisse ouverte
-- =====================================================
CREATE TABLE IF NOT EXISTS comptages_caisse (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  caisse_id               UUID        REFERENCES caisses_vendeurs(id) ON DELETE SET NULL,
  vendeur_email           TEXT        NOT NULL,
  declencheur_email       TEXT        NOT NULL,
  -- Montants théoriques calculés automatiquement au moment du comptage
  theorique_especes_cents INTEGER     NOT NULL DEFAULT 0,
  theorique_cb_cents      INTEGER     NOT NULL DEFAULT 0,
  theorique_stripe_cents  INTEGER     NOT NULL DEFAULT 0,
  -- Montants réellement comptés par l'admin
  reel_especes_cents      INTEGER,
  reel_cb_cents           INTEGER,
  -- Écarts (réel - théorique)
  ecart_especes_cents     INTEGER,
  ecart_cb_cents          INTEGER,
  commentaire             TEXT,
  statut                  TEXT        NOT NULL DEFAULT 'valide'
                          CHECK (statut IN ('valide', 'ecart_signale'))
);

-- =====================================================
-- 4. TRIGGER : Synchronisation automatique de montant_paye_cents
--    dans la table commandes à chaque mouvement dans comptabilite
-- =====================================================
CREATE OR REPLACE FUNCTION sync_commande_montant_paye()
RETURNS TRIGGER AS $$
DECLARE
  v_commande_id UUID;
  v_net         INTEGER;
BEGIN
  -- Détermine l'ID de commande concerné
  IF TG_OP = 'DELETE' THEN
    v_commande_id := OLD.commande_id;
  ELSE
    v_commande_id := NEW.commande_id;
  END IF;

  -- Rien à faire si pas de commande liée
  IF v_commande_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Calcule le net encaissé (somme algébrique de tous les mouvements)
  SELECT COALESCE(SUM(montant_cents), 0)
  INTO   v_net
  FROM   comptabilite
  WHERE  commande_id = v_commande_id;

  -- Met à jour le montant payé dans la commande
  UPDATE commandes
  SET    montant_paye_cents = v_net
  WHERE  id = v_commande_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_commande_montant_paye ON comptabilite;
CREATE TRIGGER trg_sync_commande_montant_paye
  AFTER INSERT OR UPDATE OR DELETE ON comptabilite
  FOR EACH ROW
  EXECUTE FUNCTION sync_commande_montant_paye();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE caisses_vendeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptabilite      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptages_caisse  ENABLE ROW LEVEL SECURITY;

-- Policies : accès complet aux utilisateurs authentifiés
DO $$
BEGIN
  DROP POLICY IF EXISTS "auth_rw_caisses_vendeurs" ON caisses_vendeurs;
  CREATE POLICY "auth_rw_caisses_vendeurs" ON caisses_vendeurs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "auth_rw_comptabilite" ON comptabilite;
  CREATE POLICY "auth_rw_comptabilite" ON comptabilite
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "auth_rw_comptages_caisse" ON comptages_caisse;
  CREATE POLICY "auth_rw_comptages_caisse" ON comptages_caisse
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- =====================================================
-- 6. RESYNCHRONISATION des données existantes
--    Recalcule montant_paye_cents pour toutes les commandes
--    existantes depuis la table comptabilite (rattrapage)
-- =====================================================
UPDATE commandes c
SET    montant_paye_cents = (
  SELECT COALESCE(SUM(ct.montant_cents), 0)
  FROM   comptabilite ct
  WHERE  ct.commande_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM comptabilite ct WHERE ct.commande_id = c.id
);
