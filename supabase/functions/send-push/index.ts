// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── Clés VAPID (stockées dans les secrets Supabase) ──────────────────────
    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@pro-abattoir.fr';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.');
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { user_id, user_ids, title, body, url, tag } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Construire la liste des user_ids à notifier ──────────────────────────
    let targetIds: string[] = [];
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      targetIds = user_ids;
    } else if (user_id) {
      targetIds = [user_id];
    } else {
      return new Response(JSON.stringify({ error: 'user_id or user_ids required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Récupérer les abonnements push ───────────────────────────────────────
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', targetIds);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Envoyer les notifications ────────────────────────────────────────────
    const payload = JSON.stringify({ title, body, url: url ?? '/', tag });
    const results = await Promise.allSettled(
      subs.map(record =>
        webpush.sendNotification(record.subscription, payload).catch(async (err) => {
          // Abonnement expiré → supprimer de la DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', record.subscription.endpoint);
          }
          throw err;
        })
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
