import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FiUser, FiMail, FiLock, FiSave, FiAlertCircle, FiCheck } from "react-icons/fi";

export default function ProfileSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "", // Laisser vide si pas de changement
    confirmPassword: ""
  });

  // Charger les données actuelles de l'utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setFormData(prev => ({
          ...prev,
          email: user.email,
          fullName: user.user_metadata?.full_name || ""
        }));
      }
    };
    loadUserData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const updates = {
        data: { full_name: formData.fullName }
      };

      // Si l'email a changé
      if (formData.email) {
        updates.email = formData.email;
      }

      // Si un nouveau mot de passe est saisi
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas.");
        }
        updates.password = formData.password;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      setMessage("Profil mis à jour avec succès !");
      if (updates.email) {
         setMessage("Profil mis à jour ! Si vous avez changé d'email, vérifiez votre nouvelle boîte de réception pour confirmer.");
      }
      
      // Réinitialiser les champs mot de passe
      setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      
      {/* En-tête de la section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <FiUser className="text-green-400" /> Mon Profil
        </h2>
        <p className="text-slate-300 mt-2 text-sm">
          Gérez vos informations personnelles et vos identifiants de connexion.
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        
        {message && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border border-green-100 dark:border-green-800 flex items-center gap-3">
            <FiCheck className="text-xl shrink-0" />
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800 flex items-center gap-3">
            <FiAlertCircle className="text-xl shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Identité */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Nom complet</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiUser /></div>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="Votre nom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Adresse Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiMail /></div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="nom@exemple.com"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Sécurité */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Modifier le mot de passe</h3>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiLock /></div>
                    <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                    placeholder="Nouveau mot de passe"
                    />
                </div>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><FiLock /></div>
                    <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all dark:text-white"
                    placeholder="Confirmer le mot de passe"
                    />
                </div>
            </div>
            <p className="text-xs text-slate-400 italic ml-1">* Laissez vide si vous ne souhaitez pas changer de mot de passe.</p>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transform hover:scale-105 transition-all disabled:opacity-70 disabled:scale-100"
            >
              {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                  <>
                    <FiSave /> Enregistrer les modifications
                  </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}