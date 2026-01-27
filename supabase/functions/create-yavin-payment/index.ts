import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Gérer CORS (Navigateur)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Vérifier la méthode
    if (req.method !== 'POST') {
      throw new Error(`Méthode ${req.method} non supportée (POST attendu)`)
    }

    // 3. Lire le corps de la requête (Body)
    const bodyText = await req.text();
    if (!bodyText) throw new Error("Corps de requête vide");
    
    const { amount, email, ref } = JSON.parse(bodyText);
    
    // 4. Vérifier la clé API
    const yavinKey = Deno.env.get('YAVIN_SECRET_KEY')
    if (!yavinKey) {
      throw new Error("Configuration Serveur : Clé Yavin (YAVIN_SECRET_KEY) manquante.")
    }

    console.log(`[LOG] Création paiement Yavin : ${amount}€ pour ${email}`);

    // 5. Appel à Yavin
    const yavinResponse = await fetch('https://api.yavin.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${yavinKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Conversion en centimes
        currency: 'EUR',
        reference: ref,
        customer: { email: email },
        metadata: { source: 'App Abattoir' }
      }),
    })

    // --- LE CORRECTIF EST ICI ---
    // On lit la réponse en TEXTE d'abord pour éviter le crash JSON
    const responseRaw = await yavinResponse.text();
    console.log("[LOG] Réponse Yavin brute :", responseRaw);

    let data;
    try {
        data = responseRaw ? JSON.parse(responseRaw) : {};
    } catch (e) {
        throw new Error(`Yavin a renvoyé une réponse invalide (non-JSON) : ${responseRaw.substring(0, 100)}...`);
    }

    // 6. Gestion d'erreur explicite
    if (!yavinResponse.ok) {
      console.error("[ERREUR YAVIN]", data);
      const msg = data.message || data.error?.message || "Erreur inconnue";
      throw new Error(`Refus Yavin (${yavinResponse.status}) : ${msg}`);
    }

    // 7. Succès : Renvoyer le token
    return new Response(JSON.stringify({ 
      token: data.client_secret || data.token || data.id, // On cherche le token partout
      id: data.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error("[EXCEPTION SERVEUR]", error.message);
    // On renvoie TOUJOURS du JSON, même en cas d'erreur, pour ne pas planter le frontend
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // On met 200 pour que le frontend puisse lire le message "error"
    })
  }
})