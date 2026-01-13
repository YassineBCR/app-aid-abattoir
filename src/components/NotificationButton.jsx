import { useState, useEffect } from 'react';
import { FiBell, FiCheck } from 'react-icons/fi';
import { supabase } from '../lib/supabase';

// Clé publique VAPID (à remplacer par la vôtre)
const PUBLIC_VAPID_KEY = "VOTRE_PUBLIC_KEY_ICI_DE_L_ETAPE_1"; 

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationButton() {
  const [permission, setPermission] = useState(Notification.permission);
  const [loading, setLoading] = useState(false);

  const subscribeUser = async () => {
    setLoading(true);
    try {
      // 1. Demande la permission iOS/Android
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // 2. Récupère l'enregistrement du Service Worker
        const registration = await navigator.serviceWorker.ready;
        
        // 3. S'abonne au Push Manager d'Apple/Google
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });

        // 4. Sauvegarde dans Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { error } = await supabase
            .from('push_subscriptions')
            .upsert({ 
              user_id: user.id,
              subscription: subscription.toJSON()
            }, { onConflict: 'user_id, subscription' });

          if (error) throw error;
          alert("Notifications activées avec succès !");
        }
      }
    } catch (error) {
      console.error('Erreur activation:', error);
      alert("Erreur lors de l'activation des notifications.");
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'granted') {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6 flex items-center gap-3 border border-green-100 dark:border-green-800">
        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full text-green-600 dark:text-green-300">
          <FiCheck />
        </div>
        <p className="text-green-800 dark:text-green-200 text-sm font-medium">Notifications actives sur cet appareil</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6 border border-blue-100 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300">
            <FiBell />
          </div>
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-100">Notifications</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">Soyez alerté pour votre commande</p>
          </div>
        </div>
        <button
          onClick={subscribeUser}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50"
        >
          {loading ? "Activation..." : "Activer"}
        </button>
      </div>
    </div>
  );
}