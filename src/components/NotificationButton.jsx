import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const VAPID_PUBLIC_KEY = "BIeyYjfeEabOA4AwNNXVOIBAgCiE76Lzb2Di9XX0rFbgTdevTWzSYE-UGVe1jE6N3p_x4R2Uw5IIeSpVMiikTDA";
const VAPID_PRIVATE_KEY = "KMKpiMbDn4E5_-C8aQxLcBoUyX4PRNu4g6BgA7DjC2U";
const SUBJECT = "mailto:<bacoriyassine.devia@gmail.com>";

try {
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) { console.error("Config VAPID error", e); }

serve(async (req) => {
  try {
    // 1. Lire la donnée envoyée par le Webhook (Database)
    const payload = await req.json();
    
    // Le Webhook envoie la nouvelle ligne dans "record"
    const { user_id, title, body, url } = payload.record; 

    // 2. Connexion Admin pour lire les abonnements
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Récupérer les tokens de l'utilisateur
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id);

    if (error || !subs?.length) {
      console.log("Pas d'abonnement trouvé pour", user_id);
      return new Response("No subscription", { status: 200 });
    }

    // 4. Envoyer les notifications
    const promises = subs.map(sub => 
      webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, url }))
        .catch(err => console.error("Erreur envoi:", err))
    );

    await Promise.all(promises);

    return new Response("Notifications sent", { status: 200 });

  } catch (error) {
    console.error("Erreur:", error);
    return new Response(error.message, { status: 500 });
  }
});