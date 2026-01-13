// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

// REMPLACEZ CES VALEURS PAR VOS CLÉS VAPID GÉNÉRÉES
const VAPID_PUBLIC_KEY = "VOTRE_PUBLIC_KEY";
const VAPID_PRIVATE_KEY = "VOTRE_PRIVATE_KEY";
const SUBJECT = "mailto:admin@mon-abattoir.com"; 

webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  try {
    // Permettre les requêtes depuis votre site (CORS)
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }});
    }

    const { user_id, title, body, url } = await req.json();

    // Créer le client Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Récupérer les abonnements de l'utilisateur
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id);

    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: 'Aucun abonnement trouvé pour cet utilisateur' }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Envoyer la notification
    const notifications = subs.map((record) => {
      const payload = JSON.stringify({ title, body, url });
      return webpush.sendNotification(record.subscription, payload).catch((err) => {
        console.error('Erreur envoi notification:', err);
      });
    });

    await Promise.all(notifications);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});