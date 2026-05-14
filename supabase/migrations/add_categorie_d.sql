-- ================================================================
-- MIGRATION : Ajout de la catégorie D (420€)
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor → New query)
-- ================================================================

-- Insertion de la catégorie D
-- ON CONFLICT permet de ré-exécuter sans erreur si déjà présente
INSERT INTO tarifs (categorie, nom, prix_cents, acompte_cents)
VALUES ('D', 'Catégorie D', 42000, 0)
ON CONFLICT (categorie) DO UPDATE
  SET nom         = EXCLUDED.nom,
      prix_cents  = EXCLUDED.prix_cents;

-- Vérification des 4 catégories
-- SELECT categorie, nom, prix_cents / 100 AS prix_euros, acompte_cents / 100 AS acompte_euros
-- FROM tarifs ORDER BY prix_cents;
