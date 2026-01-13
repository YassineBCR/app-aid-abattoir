import { createContext, useContext, useState, useCallback, useRef } from "react";
import { FiCheck, FiAlertCircle, FiInfo, FiHelpCircle, FiVolume2 } from "react-icons/fi";

const NotificationContext = createContext();

// Son "Ding" court et efficace
const NOTIF_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  
  // Pour gérer le son sur iOS
  const audioRef = useRef(new Audio(NOTIF_SOUND_URL));
  const [audioEnabled, setAudioEnabled] = useState(false);

  // 1. Fonction pour débloquer le son (à appeler via un clic utilisateur)
  const enableAudio = useCallback(() => {
    audioRef.current.play().then(() => {
      audioRef.current.pause(); // On joue et coupe tout de suite juste pour "chauffer" le moteur audio iOS
      audioRef.current.currentTime = 0;
      setAudioEnabled(true);
    }).catch(e => console.error("Impossible d'activer l'audio iOS", e));
  }, []);

  const requestSystemPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const notifySystem = useCallback((title, body) => {
    // A. Jouer le son
    try {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.warn("Lecture auto bloquée par le navigateur:", error);
        });
      }
    } catch (e) { console.error("Erreur audio", e); }

    // B. Notif Système
    if ("Notification" in window && Notification.permission === "granted") {
      // Sur mobile, on doit parfois passer par le Service Worker, mais ceci marche sur Android/PC
      try {
        new Notification(title, { body, icon: "/vite.svg", vibrate: [200, 100, 200] });
      } catch (e) { console.error("Erreur notif native", e); }
    }

    // C. Toast App
    showNotification(`${title} - ${body}`, "success");
  }, []);

  // --- Helpers habituels ---
  const showNotification = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };
  const showConfirm = (message) => new Promise(resolve => setModal({ type: "confirm", message, resolve }));
  const showPrompt = (message, defaultValue = "") => new Promise(resolve => setModal({ type: "prompt", message, defaultValue, resolve }));
  const closeModal = (result) => { if(modal?.resolve) modal.resolve(result); setModal(null); };

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm, showPrompt, notifySystem, requestSystemPermission, enableAudio, audioEnabled }}>
      {children}

      {/* MODALS & TOASTS (inchangés) */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white z-[9999] animate-slide-up ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
            <p className="text-slate-800 dark:text-slate-100 font-bold">{modal.message}</p>
            {modal.type === "prompt" && <input id="prompt-input" className="w-full border p-2 rounded" defaultValue={modal.defaultValue} autoFocus />}
            <div className="flex gap-3">
                <button onClick={() => closeModal(modal.type === "prompt" ? document.getElementById("prompt-input").value : true)} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">OK</button>
                <button onClick={() => closeModal(modal.type === "prompt" ? null : false)} className="flex-1 bg-gray-200 py-2 rounded font-bold">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() { return useContext(NotificationContext); }