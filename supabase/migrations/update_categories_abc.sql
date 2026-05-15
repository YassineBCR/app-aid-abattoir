-- ================================================================
-- MIGRATION FINALE : A=380€  B=400€  C=420€  (suppression D)
-- À exécuter dans Supabase SQL Editor
-- ================================================================

-- 1. Tarifs
UPDATE tarifs SET prix_cents = 38000 WHERE categorie = 'A';
UPDATE tarifs SET prix_cents = 40000 WHERE categorie = 'B';
UPDATE tarifs SET prix_cents = 42000 WHERE categorie = 'C';
DELETE FROM tarifs WHERE categorie = 'D';

-- 2. Remappage des commandes par montant_total_cents
--    (aucun ordre à 36000 existant, pas de cas particulier)
UPDATE commandes SET categorie = 'A' WHERE montant_total_cents = 38000;
UPDATE commandes SET categorie = 'B' WHERE montant_total_cents = 40000;
UPDATE commandes SET categorie = 'C' WHERE montant_total_cents = 42000;

-- 3. Vérification
-- SELECT categorie, montant_total_cents/100 AS prix_euros, COUNT(*) AS nb
-- FROM commandes WHERE statut NOT IN ('disponible','brouillon')
-- GROUP BY categorie, montant_total_cents ORDER BY categorie, montant_total_cents;
