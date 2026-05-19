-- Table pour stocker les abonnements push de chaque appareil
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  subscription JSONB      NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur gère uniquement ses propres abonnements
CREATE POLICY "push_subscriptions_self"
  ON push_subscriptions FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index pour les lookups par user_id (l'Edge Function fait un IN sur user_ids)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);
