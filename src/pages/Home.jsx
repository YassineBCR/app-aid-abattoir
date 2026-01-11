import { useDarkMode } from "../contexts/DarkModeContext";
import { FiLogIn, FiUser, FiSun, FiMoon } from "react-icons/fi";

export default function Home({ onLogin }) {
  const { darkMode, toggleDarkMode } = useDarkMode();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6 safe-y safe-x transition-colors duration-200">
      <div className="absolute absolute-safe-top-right">
        <button
          onClick={toggleDarkMode}
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
        </button>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white mx-auto shadow-lg">
          <FiUser className="text-3xl" />
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
          Réservation Abattoir Aïd
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Réservez votre créneau, payez l'acompte et recevez votre numéro de ticket.
        </p>

        <button
          onClick={onLogin}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl px-6 py-3 text-base sm:text-lg font-semibold w-full shadow-lg transition-all duration-200 active:opacity-90 flex items-center justify-center gap-2"
        >
          <FiLogIn className="text-xl" />
          <span>Se connecter</span>
        </button>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Accès réservé aux clients et vendeurs autorisés
        </p>
      </div>
    </div>
  );
}
  