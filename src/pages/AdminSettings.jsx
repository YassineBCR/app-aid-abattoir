import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiSettings, FiUser, FiSave, FiAlertTriangle, FiTrash2, FiSearch, FiRefreshCw, FiCheckCircle 
} from "react-icons/fi";

// Rôles disponibles
const ROLES = ["client", "vendeur", "admin_site", "admin_global"];

export default function AdminSettings() {
  const { showNotification } = useNotification();
  
  // États Gestion Utilisateurs
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState(null); // ID de l'user en cours d'édition
  const [selectedRole, setSelectedRole] = useState("");

  // États Zone Danger
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      // On essaie de récupérer via la vue sécurisée (voir SQL) ou directement profiles
      // Si la vue n'existe pas, on fallback sur profiles (mais il manquera peut-être l'email)
      const { data, error } = await supabase.from("view_profiles_admin").select("*").order("created_at", { ascending: false }).limit(50);
      
      if (error) {
         // Fallback si la vue SQL n'est pas créée
         const { data: profiles, error: errProf } = await supabase.from("profiles").select("*").limit(50);
         if (errProf) throw errProf;
         setUsers(profiles);
      } else {
         setUsers(data);
      }
    } catch (err) {
      console.error(err);
      showNotification("Impossible de charger les utilisateurs (Vérifiez la vue SQL).", "error");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleUpdateRole(userId) {
    if (!selectedRole) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", userId);

      if (error) throw error;
      
      showNotification("Rôle mis à jour avec succès !", "success");
      setEditingUser(null);
      fetchUsers(); // Rafraichir
    } catch (err) {
      showNotification("Erreur mise à jour : " + err.message, "error");
    }
  }

  async function handleResetApp() {
    if (confirmText !== "RESET-CONFIRM") {
      return showNotification("Veuillez taper 'RESET-CONFIRM' pour valider.", "error");
    }
    
    if (!window.confirm("ÊTES-VOUS SÛR À 100% ? CELA EFFACERA TOUTES LES COMMANDES ET PAIEMENTS.")) return;

    setIsResetting(true);
    try {
      const { error } = await supabase.rpc("reset_application_data");
      if (error) throw error;
      
      showNotification("Application réinitialisée à zéro.", "success");
      setConfirmText("");
    } catch (err) {
      showNotification("Erreur Reset : " + err.message, "error");
    } finally {
      setIsResetting(false);
    }
  }

  // Filtrage local
  const filteredUsers = users.filter(u => 
    (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 safe-y safe-x animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* En-tête */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
          <div className="bg-slate-200 dark:bg-slate-800 p-3 rounded-2xl">
            <FiSettings className="text-3xl text-slate-700 dark:text-slate-200" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Paramètres Système</h1>
            <p className="text-slate-500 dark:text-slate-400">Administration avancée et maintenance</p>
          </div>
        </div>

        {/* SECTION 1 : GESTION DES RÔLES */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2"><FiUser /> Gestion des Utilisateurs</h2>
            <button onClick={fetchUsers} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><FiRefreshCw className={loadingUsers ? "animate-spin" : ""} /></button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Barre de recherche */}
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher par email ou ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>

            {/* Liste Utilisateurs */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4">Utilisateur / Email</th>
                    <th className="py-3 px-4">Rôle Actuel</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 dark:text-white">{user.email || "Email masqué"}</div>
                        <div className="text-xs text-slate-400 font-mono">{user.id}</div>
                      </td>
                      <td className="py-4 px-4">
                        {editingUser === user.id ? (
                          <select 
                            value={selectedRole} 
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="" disabled>Choisir...</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                            user.role === 'admin_global' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'vendeur' ? 'bg-blue-100 text-blue-700' :
                            user.role === 'admin_site' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {editingUser === user.id ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">Annuler</button>
                            <button onClick={() => handleUpdateRole(user.id)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"><FiSave /> Enregistrer</button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setEditingUser(user.id); setSelectedRole(user.role); }}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold"
                          >
                            Modifier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan="3" className="py-8 text-center text-slate-400 italic">Aucun utilisateur trouvé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1"><FiInfo /> Si les emails ne s'affichent pas, vérifiez que la vue SQL `view_profiles_admin` est bien créée.</p>
          </div>
        </div>

        {/* SECTION 2 : ZONE DE DANGER */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/50 overflow-hidden">
          <div className="p-6 bg-red-50 dark:bg-red-900/20 flex items-center gap-4 border-b border-red-100 dark:border-red-900/50">
            <div className="bg-red-100 text-red-600 p-3 rounded-full animate-pulse"><FiAlertTriangle className="text-2xl" /></div>
            <div>
              <h2 className="text-xl font-bold text-red-700 dark:text-red-400">Zone de Danger</h2>
              <p className="text-red-600/80 dark:text-red-400/80 text-sm">Actions irréversibles sur la base de données</p>
            </div>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">Réinitialiser l'Application</h3>
                <p className="text-slate-500 text-sm max-w-lg">
                  Cette action va <strong className="text-red-600">SUPPRIMER TOUTES</strong> les commandes, paiements, logs et notifications.
                  <br/>Les comptes utilisateurs, les créneaux et la configuration des tarifs seront conservés.
                </p>
              </div>
              
              <div className="w-full md:w-auto bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Confirmation de sécurité</label>
                <input 
                  type="text" 
                  placeholder="Tapez RESET-CONFIRM"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm font-mono focus:border-red-500 outline-none"
                />
                <button 
                  onClick={handleResetApp}
                  disabled={confirmText !== "RESET-CONFIRM" || isResetting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  {isResetting ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                  {isResetting ? "Réinitialisation..." : "TOUT EFFACER"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FiInfo({className}) { return <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className={className} height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>; }