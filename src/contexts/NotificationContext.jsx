import { createContext, useContext, useState, useCallback } from "react";
import { FiCheck, FiAlertCircle, FiInfo, FiHelpCircle } from "react-icons/fi";

const NotificationContext = createContext();

// Un petit son "Ding" pour les commandes (hébergé en ligne pour l'exemple)
const NOTIF_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  // 1. Demander la permission (à appeler au chargement du Dashboard)
  const requestSystemPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  // 2. Envoyer une notification Système (PC/Android) + Son
  const notifySystem = useCallback((title, body) => {
    // A. Jouer le son
    try {
      const audio = new Audio(NOTIF_SOUND_URL);
      audio.play().catch(e => console.warn("Son bloqué par le navigateur (interaction requise)", e));
    } catch (e) {
      console.error("Erreur audio", e);
    }

    // B. Afficher la notif visuelle système
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: body,
        icon: "/vite.svg", // Tu pourras mettre ton logo ici
        vibrate: [200, 100, 200] // Vibration sur mobile
      });
    }

    // C. Afficher aussi le toast dans l'app
    showNotification(`${title} - ${body}`, "success");
  }, []);

  // --- (Le reste est ton code existant pour les Toasts/Modals) ---
  const showNotification = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setModal({ type: "confirm", message, resolve });
    });
  };

  const showPrompt = (message, defaultValue = "") => {
    return new Promise((resolve) => {
      setModal({ type: "prompt", message, defaultValue, resolve });
    });
  };

  const closeModal = (result) => {
    if (modal?.resolve) modal.resolve(result);
    setModal(null);
  };

  return (
    <NotificationContext.Provider value={{ 
      showNotification, showConfirm, showPrompt, 
      notifySystem, requestSystemPermission // 👈 On exporte les nouvelles fonctions
    }}>
      {children}
      
      {/* TOAST (Petit message en bas) */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white animate-slide-up z-[9999] ${
          toast.type === "success" ? "bg-green-600" : 
          toast.type === "error" ? "bg-red-600" : 
          toast.type === "warning" ? "bg-orange-500" : "bg-blue-600"
        }`}>
          {toast.type === "success" && <FiCheck className="text-xl" />}
          {toast.type === "error" && <FiAlertCircle className="text-xl" />}
          {toast.type === "info" && <FiInfo className="text-xl" />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* MODAL (Confirmation / Prompt) */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4 border border-slate-200 dark:border-slate-700 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-xl font-bold text-slate-800 dark:text-slate-100">
               <FiHelpCircle className="text-indigo-600 dark:text-indigo-400" />
               Confirmation
            </div>
            <p className="text-slate-600 dark:text-slate-300">{modal.message}</p>
            
            {modal.type === "prompt" && (
              <input 
                autoFocus
                className="w-full border p-2 rounded-lg dark:bg-slate-700 dark:text-white"
                defaultValue={modal.defaultValue}
                id="prompt-input"
              />
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => closeModal(modal.type === "prompt" ? document.getElementById("prompt-input").value : true)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors"
              >
                Valider
              </button>
              <button 
                onClick={() => closeModal(modal.type === "prompt" ? null : false)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl font-bold transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}