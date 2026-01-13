import { Link, useLocation } from "react-router-dom";
import { FiHome, FiGrid, FiLogIn, FiLogOut } from "react-icons/fi";
import { supabase } from "../lib/supabase";

export default function Navbar({ session }) {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  // Fonction utilitaire pour vérifier si un lien est actif
  const isActive = (path) => location.pathname === path;

  // Style des liens
  const linkClass = (path) => `
    flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 font-medium
    ${isActive(path) 
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
    }
  `;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / Titre à gauche */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-green-700 dark:text-green-400">
            <FiGrid className="text-2xl" />
            <span>Abattoir Aïd</span>
          </Link>

          {/* Onglets pour Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Link to="/" className={linkClass("/")}>
              <FiHome /> Accueil
            </Link>
            
            {session && (
              <Link to="/dashboard" className={linkClass("/dashboard")}>
                <FiGrid /> Mon Espace
              </Link>
            )}

            {!session ? (
              <Link to="/auth" className="ml-4 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full font-medium transition-colors shadow-lg shadow-green-500/20">
                Se connecter
              </Link>
            ) : (
              <button 
                onClick={handleLogout}
                className="ml-4 flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors"
              >
                <FiLogOut /> Déconnexion
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barre de navigation Mobile (en bas de l'écran) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 pb-safe z-50 flex justify-around items-center">
        <Link to="/" className={`flex flex-col items-center p-2 rounded-lg ${isActive("/") ? "text-green-600" : "text-slate-500"}`}>
          <FiHome className="text-xl mb-1" />
          <span className="text-xs">Accueil</span>
        </Link>
        
        {session && (
          <Link to="/dashboard" className={`flex flex-col items-center p-2 rounded-lg ${isDashboard ? "text-green-600" : "text-slate-500"}`}>
            <FiGrid className="text-xl mb-1" />
            <span className="text-xs">Espace</span>
          </Link>
        )}

        {!session ? (
          <Link to="/auth" className={`flex flex-col items-center p-2 rounded-lg ${isActive("/auth") ? "text-green-600" : "text-slate-500"}`}>
            <FiLogIn className="text-xl mb-1" />
            <span className="text-xs">Connexion</span>
          </Link>
        ) : (
          <button onClick={handleLogout} className="flex flex-col items-center p-2 rounded-lg text-slate-500 hover:text-red-500">
            <FiLogOut className="text-xl mb-1" />
            <span className="text-xs">Sortir</span>
          </button>
        )}
      </div>
    </nav>
  );
}