import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiPackage, FiClock, FiUser, FiLogOut, FiTarget, FiMail, FiSun, FiMoon, 
  FiCamera, FiBell, FiActivity, FiDollarSign, FiTag, FiPieChart, FiX, 
  FiLayers, FiHome, FiSettings, FiList, FiMenu, FiChevronRight, FiMessageSquare
} from "react-icons/fi";

// IMPORT DES COMPOSANTS
import Vendeur from "./Vendeur";
import Creneaux from "./Creneaux"; 
import Tableau from "./Tableau"; 
import AdminSMS from "./AdminSMS";
import PriseEnCharge from "./PriseEnCharge"; 
import AdminLogs from "./AdminLogs"; 
import AdminCaisse from "./AdminCaisse";
import Bouclage from "./Bouclage";
import AdminSettings from "./AdminSettings";
import Statistiques from "./Statistiques";

// ---- CONFIGURATION DES RÔLES ET DE L'ORDRE D'AFFICHAGE ----
const PERMS = {
  client: { sections: [] },
  vendeur: { sections: ["prise_en_charge", "tableau", "bouclage", "commandes"] },
  admin_site: { sections: ["prise_en_charge", "tableau", "creneaux", "commandes", "statistiques"] },
  admin_global: { sections: ["prise_en_charge", "tableau", "statistiques", "creneaux", "commandes", "bouclage", "finance", "sms", "logs", "settings"] },
};

// ---- CONFIGURATION DES ONGLETS ----
const SECTIONS = {
  prise_en_charge: { label: "Guichet Unique", component: PriseEnCharge, Icon: FiCamera, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-500" },
  tableau: { label: "Registre Global", component: Tableau, Icon: FiList, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-500/10", border: "border-teal-500" },
  statistiques: { label: "Statistiques", component: Statistiques, Icon: FiPieChart, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-500" },
  creneaux: { label: "Créneaux & Stock", component: Creneaux, Icon: FiClock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-500" },
  commandes: { label: "Commandes Web", component: Vendeur, Icon: FiPackage, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-500" },
  bouclage: { label: "Bouclage", component: Bouclage, Icon: FiTag, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-500" },
  finance: { label: "Comptabilité", component: AdminCaisse, Icon: FiDollarSign, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-500/10", border: "border-yellow-500" },
  
  // 👉 MODIFICATION ICI : On renomme "Marketing SMS" en "MARKETING"
  sms: { label: "Marketing", component: AdminSMS, Icon: FiMessageSquare, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-500" },
  
  logs: { label: "Traçabilité (Logs)", component: AdminLogs, Icon: FiActivity, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-500/10", border: "border-slate-500" },
  settings: { label: "Paramètres", component: AdminSettings, Icon: FiSettings, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-500/10", border: "border-gray-500" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { showNotification } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function loadProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); setLoading(false); return; }

    const { data, error } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
    setLoading(false);

    if (error) { showNotification("Erreur chargement profil", "error"); return; }

    const p = { id: user.id, email: user.email, role: data?.role || "client" };
    setProfile(p);

    const allowed = PERMS[p.role]?.sections || [];
    setActive((prev) => (prev && allowed.includes(prev) ? prev : allowed[0] || null));
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { loadProfile(); });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const allowedSections = useMemo(() => {
    if (!profile?.role) return [];
    return PERMS[profile.role]?.sections || [];
  }, [profile]);

  const ActiveComponent = active ? SECTIONS[active]?.component : null;

  async function logout() { await supabase.auth.signOut(); }

  const handleNavClick = (key) => {
      setActive(key);
      setMobileMenuOpen(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold animate-pulse text-xl">Chargement de votre espace...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold">Connexion requise</div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* ================= SIDEBAR GAUCHE (DESKTOP) ================= */}
      <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-20 shadow-2xl shadow-slate-200/50 dark:shadow-none transition-all duration-300">
          
          <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-700/50">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                  <FiTarget className="text-xl" />
              </div>
              <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Pro Abattoir</h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">v2.0</span>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1.5 no-scrollbar">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-2 mt-2">Menu Principal</p>
              {allowedSections.map((key) => {
                  const section = SECTIONS[key];
                  const Icon = section.Icon;
                  const isActive = active === key;
                  
                  return (
                      <button 
                          key={key}
                          onClick={() => handleNavClick(key)} 
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 group
                              ${isActive 
                                  ? `${section.bg} ${section.color} shadow-sm ring-1 ring-inset ring-slate-200/50 dark:ring-slate-700/50` 
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                              }
                          `}
                      >
                          <div className="flex items-center gap-3">
                              <Icon className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110 opacity-70'}`} /> 
                              {section.label}
                          </div>
                          {isActive && <div className={`w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]`}></div>}
                      </button>
                  );
              })}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-600">
                      <FiUser className="text-lg"/>
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile.email.split('@')[0]}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{profile.role.replace('_', ' ')}</p>
                  </div>
              </div>
          </div>
      </aside>

      {/* ================= MENU MOBILE ================= */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)}></div>
              <div className="w-4/5 max-w-sm h-full bg-white dark:bg-slate-800 shadow-2xl relative flex flex-col animate-slide-in-left">
                  <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white"><FiTarget /></div>
                          <h1 className="text-xl font-black text-slate-900 dark:text-white">Pro Abattoir</h1>
                      </div>
                      <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-700 rounded-full"><FiX size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {allowedSections.map((key) => {
                          const section = SECTIONS[key];
                          const isActive = active === key;
                          return (
                              <button 
                                  key={key} onClick={() => handleNavClick(key)} 
                                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold text-sm transition-all
                                      ${isActive ? `${section.bg} ${section.color}` : "text-slate-600 dark:text-slate-400"}`}
                              >
                                  <section.Icon className="text-xl" /> {section.label}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {/* ================= ZONE PRINCIPALE ================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50 dark:bg-slate-900/50">
        
        <header className="h-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600">
                    <FiMenu className="text-xl"/>
                </button>
                <div className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500">
                    Espace de Travail <FiChevronRight /> <span className="text-slate-800 dark:text-white">{SECTIONS[active]?.label}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => navigate('/')} className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                    <FiHome className="text-lg"/> Site
                </button>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                <button onClick={toggleDarkMode} className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">{darkMode ? <FiSun className="text-xl"/> : <FiMoon className="text-xl"/>}</button>
                <button onClick={logout} className="p-2.5 rounded-xl text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-500/10 transition-colors" title="Déconnexion"><FiLogOut className="text-xl"/></button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 relative scroll-smooth">
            <div className="max-w-7xl mx-auto">
                {ActiveComponent ? (
                    <div className="animate-fade-in-up">
                        <ActiveComponent changeTab={setActive} />
                    </div>
                ) : (
                    <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6"><FiLayers className="text-5xl"/></div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Sélectionnez un outil</h2>
                        <p className="text-slate-500 mt-2">Utilisez le menu latéral pour naviguer dans votre espace.</p>
                    </div>
                )}
            </div>
        </main>

      </div>
    </div>
  );
}