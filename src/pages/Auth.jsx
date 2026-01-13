import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiMail, FiLock, FiUser, FiArrowRight, FiCheck, FiAlertCircle, FiChevronLeft } from "react-icons/fi";

export default function Auth() {
  const navigate = useNavigate();
  
  // États : 'login' | 'register' | 'forgot'
  const [view, setView] = useState("login");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Champs du formulaire
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Nettoyer les messages quand on change de vue
  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [view]);

  // --- 1. CONNEXION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
    } else {
      // --- CORRECTION IMPORTANTE ---
      // On force la redirection vers le dashboard une fois connecté
      navigate("/dashboard");
    }
  };

  // --- 2. INSCRIPTION ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Inscription réussie ! Veuillez vérifier vos emails pour confirmer.");
    }
    setLoading(false);
  };

  // --- 3. MOT DE PASSE OUBLIÉ (Envoi du mail) ---
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // L'URL vers laquelle l'utilisateur sera redirigé depuis l'email
      const redirectUrl = `${window.location.origin}/update-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setMessage("Si cet email existe, vous recevrez un lien de réinitialisation.");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDU VISUEL ---
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-slate-900 dark:via-green-950 dark:to-emerald-950 transition-colors duration-500">
      
      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700 overflow-hidden relative transition-all duration-300">
        
        {/* Barre décorative en haut */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-600"></div>

        <div className="p-8 sm:p-10">
          
          {/* En-tête dynamique */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {view === "login" && "Connexion"}
              {view === "register" && "Inscription"}
              {view === "forgot" && "Récupération"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
              {view === "login" && "Accédez à votre espace"}
              {view === "register" && "Rejoignez-nous"}
              {view === "forgot" && "Réinitialisez votre accès"}
            </p>
          </div>

          {/* Messages d'erreur ou de succès */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800 flex gap-3 animate-fade-in">
              <FiAlertCircle className="mt-1 flex-shrink-0" /> <p className="text-sm">{error}</p>
            </div>
          )}
          {message && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border border-green-100 dark:border-green-800 flex gap-3 animate-fade-in">
              <FiCheck className="mt-1 flex-shrink-0" /> <p className="text-sm">{message}</p>
            </div>
          )}

          {/* Formulaire Unique */}
          <form onSubmit={view === "login" ? handleLogin : view === "register" ? handleRegister : handleResetPassword} className="space-y-5">
            
            {/* Champ Nom (Inscription uniquement) */}
            {view === "register" && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-green-500 transition-colors"><FiUser /></div>
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all dark:text-white"
                  required
                />
              </div>
            )}

            {/* Champ Email (Toujours visible) */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-green-500 transition-colors"><FiMail /></div>
              <input
                type="email"
                placeholder="Adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all dark:text-white"
                required
              />
            </div>

            {/* Champ Mot de passe (Caché si mot de passe oublié) */}
            {view !== "forgot" && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-green-500 transition-colors"><FiLock /></div>
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all dark:text-white"
                  required
                />
              </div>
            )}

            {/* Lien Mot de passe oublié (Login uniquement) */}
            {view === "login" && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setView("forgot")} className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {/* Bouton d'action */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-500/30 transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {view === "login" && "Se connecter"}
                    {view === "register" && "S'inscrire"}
                    {view === "forgot" && "Envoyer le lien"}
                  </span>
                  <FiArrowRight />
                </>
              )}
            </button>
          </form>

          {/* Navigation bas de page */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            {view === "forgot" ? (
              <button onClick={() => setView("login")} className="flex items-center justify-center gap-2 mx-auto font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <FiChevronLeft /> Retour à la connexion
              </button>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                {view === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}
                <button
                  onClick={() => setView(view === "login" ? "register" : "login")}
                  className="font-bold text-green-600 hover:text-green-700 dark:text-green-400 transition-colors ml-1"
                >
                  {view === "login" ? "S'inscrire" : "Se connecter"}
                </button>
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}