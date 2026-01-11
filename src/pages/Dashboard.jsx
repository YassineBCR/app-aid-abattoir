import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { 
  FiCalendar, FiPackage, FiClock, FiBarChart2, FiFileText, 
  FiUser, FiLogOut, FiTarget, FiMail, FiSun, FiMoon 
} from "react-icons/fi";
import { HiOutlineInbox } from "react-icons/hi";

import Client from "./Client";
import Vendeur from "./Vendeur";
import AdminSite from "./AdminSite";
import Tableau from "./Tableau";
import Stock from "./Stock";
import AdminAgneaux from "./Adminagneaux";
import AdminSMS from "./AdminSMS";

// ---- RBAC: permissions par rôle ----
const PERMS = {
  client: { sections: ["reserver"] },
  vendeur: { sections: ["commandes", "tableau"] },
  admin_site: { sections: ["commandes", "creneaux", "tableau", "stock"] },
  admin_global: { sections: ["commandes", "creneaux", "tableau", "stock","agneaux","sms"] },
};

// ---- Libellés + composants avec icônes ----
const SECTIONS = {
  reserver: { label: "Réserver", component: Client, Icon: FiCalendar, color: "from-green-500 to-emerald-600" },
  commandes: { label: "Commandes", component: Vendeur, Icon: FiPackage, color: "from-green-600 to-teal-600" },
  creneaux: { label: "Créneaux", component: AdminSite, Icon: FiClock, color: "from-emerald-500 to-green-600" },
  tableau: { label: "Tableau", component: Tableau, Icon: FiBarChart2, color: "from-teal-500 to-cyan-600" },
  stock: { label: "Stock", component: Stock, Icon: FiFileText, color: "from-green-400 to-emerald-500" },
  agneaux: { label: "Agneaux & Tarifs", component: AdminAgneaux, Icon: FiUser, color: "from-emerald-600 to-teal-600" },
  sms: { label: "SMS & Marketing", component: AdminSMS, Icon: FiMail, color: "from-teal-400 to-green-500" },
};

export default function Dashboard() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // {id, email, role}
  const [active, setActive] = useState(null);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    setLoading(false);

    if (error) {
      alert("Erreur chargement profil: " + error.message);
      return;
    }

    const p = {
      id: user.id,
      email: user.email,
      role: data?.role || "client",
    };

    setProfile(p);

    const allowed = PERMS[p.role]?.sections || [];
    setActive((prev) => (prev && allowed.includes(prev) ? prev : allowed[0] || null));
  }

  useEffect(() => {
    loadProfile();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const allowedSections = useMemo(() => {
    if (!profile?.role) return [];
    return PERMS[profile.role]?.sections || [];
  }, [profile]);

  const ActiveComponent = active ? SECTIONS[active]?.component : null;

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center safe-y safe-x">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-green-200 dark:border-green-800 border-t-green-600 dark:border-t-green-400 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 font-semibold text-lg">Chargement...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6 safe-y safe-x">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 w-full max-w-md space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white mx-auto shadow-md">
            <FiUser className="text-2xl" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">Connexion requise</div>
          <p className="text-slate-600 dark:text-slate-400">Connecte-toi pour accéder au dashboard.</p>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role) => {
    const badges = {
      client: { color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", label: "Client" },
      vendeur: { color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", label: "Vendeur" },
      admin_site: { color: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400", label: "Admin Site" },
      admin_global: { color: "bg-green-200 dark:bg-green-800/40 text-green-800 dark:text-green-300", label: "Admin Global" },
    };
    return badges[role] || badges.client;
  };

  const roleBadge = getRoleBadge(profile.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-200">
      {/* Header avec gradient vert */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-700 dark:via-emerald-700 dark:to-teal-700 shadow-lg safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 safe-x py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-md flex-shrink-0">
                  <FiTarget className="text-xl sm:text-2xl" />
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white truncate">Dashboard</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-white/90 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FiUser className="text-sm sm:text-base" />
                  <span className="truncate max-w-[200px] sm:max-w-none">{profile.email}</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${roleBadge.color} bg-white/20 backdrop-blur-sm whitespace-nowrap`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={toggleDarkMode}
                className="bg-white/20 hover:bg-white/30 text-white p-2.5 sm:p-3 rounded-xl transition-all duration-200 active:opacity-80 flex items-center justify-center"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <FiSun className="text-lg sm:text-xl" /> : <FiMoon className="text-lg sm:text-xl" />}
              </button>
              <button
                onClick={logout}
                className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-colors duration-200 active:opacity-80 flex items-center gap-2"
              >
                <FiLogOut className="text-base sm:text-lg" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Navigation tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-2 sm:p-3">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {allowedSections.map((key) => {
                const section = SECTIONS[key];
                const Icon = section.Icon;
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm lg:text-base transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-r ${section.color} text-white shadow-md`
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    <Icon className="text-base sm:text-lg lg:text-xl flex-shrink-0" />
                    <span className="whitespace-nowrap">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {ActiveComponent ? (
              <ActiveComponent />
            ) : (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                  <HiOutlineInbox className="text-3xl sm:text-4xl text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Aucune section disponible pour ce rôle.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
