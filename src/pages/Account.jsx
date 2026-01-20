import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FiUser, FiMail, FiLock, FiSave, FiAlertCircle, FiCheck, FiArrowLeft, FiLogOut } from "react-icons/fi";

export default function Account() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "", 
    confirmPassword: ""
  });

  // Charger les données
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setFormData(prev => ({
        ...prev,
        email: user.email,
        fullName: user.user_metadata?.full_name || ""
      }));
      setFetching(false);
    };
    loadUserData();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const updates = { data: { full_name: formData.fullName } };

      if (formData.email !== formData.email) updates.email = formData.email;
      
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) throw new Error("Les mots de passe ne correspondent pas.");
        updates.password = formData.password;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      setMessage("Profil mis à jour avec succès !");
      if (updates.email) setMessage("Email mis à jour ! Vérifiez votre boîte de réception.");
      
      setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      
      <div className="max-w-xl w-full space-y-8">
        
        {/* En-tête avec bouton retour */}
        <div className="flex items-center justify-between">
            <button 
                onClick={() => navigate(-1)} 
                className="flex items-center gap-2 text-slate-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 transition-colors font-medium"
            >
                <FiArrowLeft /> Retour
            </button>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Mon Compte</h2>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700 overflow-hidden p-8">
            
            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100 dark:border-slate-700">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-green-500/30">
                    <FiUser />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{formData.fullName || "Utilisateur"}</h3>
                    <p className="text-slate-500 text-sm">{formData.email}</p>
                </div>
            </div>

            {message && (
                <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border border-green-100 dark:border-green-800 flex items-center gap-3 animate-fade-in">
                    <FiCheck className="shrink-0" /> <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800 flex items-center gap-3 animate-fade-in">
                    <FiAlertCircle className="shrink-0" /> <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Informations personnelles</label>
                    <div className="grid gap-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiUser /></div>
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Nom complet"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiMail /></div>
                            <input
                                type="email"
                                name="email"
                                placeholder="Adresse email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Sécurité</label>
                    <div className="grid gap-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiLock /></div>
                            <input
                                type="password"
                                name="password"
                                placeholder="Nouveau mot de passe"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiLock /></div>
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirmer le mot de passe"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 italic ml-1">* Laissez vide pour conserver le mot de passe actuel.</p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transform hover:scale-[1.02] transition-all disabled:opacity-70 disabled:scale-100 mt-4"
                >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiSave /> Enregistrer</>}
                </button>

            </form>
        </div>
      </div>
    </div>
  );
}
test