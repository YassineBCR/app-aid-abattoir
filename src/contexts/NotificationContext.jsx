import { createContext, useContext, useState } from "react";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [alertDialog, setAlertDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [promptDialog, setPromptDialog] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Fonction pour afficher une alerte (remplace alert())
  const showAlert = (message) => {
    return new Promise((resolve) => {
      setAlertDialog({ message, resolve });
    });
  };

  // Fonction pour afficher une confirmation (remplace confirm())
  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  };

  // Fonction pour afficher un prompt (remplace prompt())
  const showPrompt = (message, defaultValue = "") => {
    return new Promise((resolve) => {
      setPromptDialog({ message, defaultValue, resolve });
    });
  };

  // Fonction pour afficher une notification toast
  const showNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
    return id;
  };

  const handleAlertClose = () => {
    if (alertDialog?.resolve) alertDialog.resolve();
    setAlertDialog(null);
  };

  const handleConfirmYes = () => {
    if (confirmDialog?.resolve) confirmDialog.resolve(true);
    setConfirmDialog(null);
  };

  const handleConfirmNo = () => {
    if (confirmDialog?.resolve) confirmDialog.resolve(false);
    setConfirmDialog(null);
  };

  const handlePromptSubmit = (value) => {
    if (promptDialog?.resolve) promptDialog.resolve(value);
    setPromptDialog(null);
  };

  const handlePromptCancel = () => {
    if (promptDialog?.resolve) promptDialog.resolve(null);
    setPromptDialog(null);
  };

  return (
    <NotificationContext.Provider
      value={{ showAlert, showConfirm, showPrompt, showNotification }}
    >
      {children}
      {/* Alert Dialog */}
      {alertDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in">
            <p className="text-gray-800 dark:text-slate-100 text-lg">{alertDialog.message}</p>
            <button
              onClick={handleAlertClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in">
            <p className="text-gray-800 dark:text-slate-100 text-lg">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmNo}
                className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 font-bold py-3 rounded-xl"
              >
                Non
              </button>
              <button
                onClick={handleConfirmYes}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl"
              >
                Oui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Dialog */}
      {promptDialog && (
        <PromptDialog
          message={promptDialog.message}
          defaultValue={promptDialog.defaultValue}
          onSubmit={handlePromptSubmit}
          onCancel={handlePromptCancel}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notif) => (
          <ToastNotification
            key={notif.id}
            message={notif.message}
            type={notif.type}
            onClose={() => setNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

function PromptDialog({ message, defaultValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in">
        <p className="text-gray-800 dark:text-slate-100 text-lg">{message}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-xl p-3 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 font-bold py-3 rounded-xl"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl"
          >
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}

function ToastNotification({ message, type, onClose }) {
  const bgColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  return (
    <div
      className={`${bgColors[type] || bgColors.info} text-white px-6 py-4 rounded-xl shadow-lg flex items-center justify-between gap-4 min-w-[300px] animate-fade-in`}
    >
      <p className="flex-1">{message}</p>
      <button onClick={onClose} className="text-white hover:text-gray-200 font-bold text-lg">
        ×
      </button>
    </div>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
