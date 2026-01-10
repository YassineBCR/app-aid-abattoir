import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code) return json({ error: "missing_code" }, 400);

    const clientId = Deno.env.get("SUMUP_CLIENT_ID");
    const clientSecret = Deno.env.get("SUMUP_CLIENT_SECRET");
    const redirectUri = Deno.env.get("SUMUP_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      return json(
        {
          error: "missing_sumup_oauth_secrets",
          missing: {
            SUMUP_CLIENT_ID: !clientId,
            SUMUP_CLIENT_SECRET: !clientSecret,
            SUMUP_REDIRECT_URI: !redirectUri,
          },
        },
        500
      );
    }

    // Exchange auth code -> tokens
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("code", String(code));
    body.set("redirect_uri", redirectUri);

    const res = await fetch("https://api.sumup.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: "sumup_token_exchange_failed", status: res.status, received: data }, 500);
    }

    const refresh_token = data?.refresh_token;
    const access_token = data?.access_token;
    const expires_in = Number(data?.expires_in ?? 0);

    if (!refresh_token) {
      return json({ error: "no_refresh_token_returned", received: data }, 500);
    }

    // Store in DB (singleton row id=1)
    const sbUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!sbUrl || !serviceKey) {
      return json(
        {
          error: "missing_supabase_service_secrets",
          missing: { SUPABASE_URL: !sbUrl, SUPABASE_SERVICE_ROLE_KEY: !serviceKey },
        },
        500
      );
    }

    const admin = createClient(sbUrl, serviceKey);

    const access_expires_at =
      access_token && expires_in
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null;

    const { error: upErr } = await admin.from("sumup_config").upsert(
      {
        id: 1,
        refresh_token,
        access_token: access_token ?? null,
        access_expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (upErr) return json({ error: "db_upsert_failed", details: upErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: "unhandled_exception", message: e?.message || String(e) }, 500);
  }
});
