import { supabase } from './supabase';

// Clé publique VAPID (safe à exposer côté client)
const VAPID_PUBLIC_KEY = 'BBPq9PRLW4fjm42LGzAWENRErKM93ayEXbgRn-3cLqzOLFuO-jXSe-8rVn1_FzompAV74FpDgkHqXCw1-IIrWRA';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Enregistre l'appareil pour recevoir des push, sauvegarde l'abonnement en DB
export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const subJson = sub.toJSON();
    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: subJson.endpoint, subscription: subJson },
      { onConflict: 'endpoint' }
    );

    return sub;
  } catch (err) {
    console.warn('Push registration failed:', err);
    return null;
  }
}

// Supprime l'abonnement push de l'appareil courant
export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.toJSON().endpoint;
    await sub.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err) {
    console.warn('Push unregister failed:', err);
  }
}

// Envoie une notification push à un ou plusieurs utilisateurs via l'Edge Function
export async function sendPushToUser({ userId, userIds, title, body, url = '/', tag }) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_id: userId, user_ids: userIds, title, body, url, tag },
    });
  } catch (err) {
    console.warn('sendPushToUser failed:', err);
  }
}
