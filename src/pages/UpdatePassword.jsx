import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
// --- MODIFICATION : Ajout de FiX pour la croix rouge ---
import { FiLock, FiCheck, FiAlertCircle, FiX } from "react-icons/fi";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // --- NOUVEAU : Variables dynamiques pour la validation visuelle ---
  const isLengthValid = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);

  // Vérification de sécurité
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError(null);

    // Blocage de sécurité
    if (!isLengthValid || !hasUppercase) {
      setError("Veuillez respecter les critères de sécurité du mot de passe.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
        
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">
          Nouveau mot de passe
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl flex gap-2 items-center text-sm">
            <FiAlertCircle className="flex-shrink-0" /> {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-8 animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheck className="text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-green-600 mb-2">Mot de passe modifié !</h3>
            <p className="text-slate-500 dark:text-slate-400">Redirection vers votre espace...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <FiLock />
                </div>
                <input
                  type="password"
                  placeholder="Entrez votre nouveau mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 outline-none dark:text-white transition-all"
                  required
                />
              </div>
              
              {/* --- NOUVEAU : Indicateurs dynamiques (Rouge -> Vert) --- */}
              <div className="mt-3 ml-2 space-y-1.5">
                <div className={`flex items-center text-xs transition-colors duration-300 ${isLengthValid ? 'text-green-500' : 'text-red-500 dark:text-red-400'}`}>
                  {isLengthValid ? <FiCheck className="mr-1.5 text-sm" /> : <FiX className="mr-1.5 text-sm" />}
                  <span>Au moins 12 caractères</span>
                </div>
                <div className={`flex items-center text-xs transition-colors duration-300 ${hasUppercase ? 'text-green-500' : 'text-red-500 dark:text-red-400'}`}>
                  {hasUppercase ? <FiCheck className="mr-1.5 text-sm" /> : <FiX className="mr-1.5 text-sm" />}
                  <span>Au moins une lettre majuscule</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isLengthValid || !hasUppercase} // Le bouton est désactivé tant que ce n'est pas vert
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Modification..." : "Valider le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}