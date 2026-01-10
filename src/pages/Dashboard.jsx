import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import Client from "./Client";
import Vendeur from "./Vendeur";
import AdminSite from "./AdminSite";
import Tableau from "./Tableau";
import Stock from "./Stock";

// ---- RBAC: permissions par rôle ----
const PERMS = {
  client: { sections: ["reserver"] },
  vendeur: { sections: ["commandes", "tableau"] },
  admin_site: { sections: ["commandes", "creneaux", "tableau", "stock"] },
  admin_global: { sections: ["commandes", "creneaux", "tableau", "stock"] },
};

// ---- Libellés + composants ----
const SECTIONS = {
  reserver: { label: "Réserver", component: Client, icon: "📅", color: "from-indigo-500 to-purple-600" },
  commandes: { label: "Commandes", component: Vendeur, icon: "📦", color: "from-blue-500 to-cyan-600" },
  creneaux: { label: "Créneaux", component: AdminSite, icon: "🗓️", color: "from-green-500 to-emerald-600" },
  tableau: { label: "Tableau", component: Tableau, icon: "📊", color: "from-orange-500 to-red-600" },
  stock: { label: "Stock", component: Stock, icon: "📋", color: "from-purple-500 to-pink-600" },
};

export default function Dashboard() {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-indigo-600 font-semibold text-lg">Chargement...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-md space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-3xl mx-auto shadow-md">
            🔒
          </div>
          <div className="text-2xl font-bold text-slate-800">Connexion requise</div>
          <p className="text-slate-600">Connecte-toi pour accéder au dashboard.</p>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role) => {
    const badges = {
      client: { color: "bg-blue-100 text-blue-700", label: "Client" },
      vendeur: { color: "bg-green-100 text-green-700", label: "Vendeur" },
      admin_site: { color: "bg-purple-100 text-purple-700", label: "Admin Site" },
      admin_global: { color: "bg-red-100 text-red-700", label: "Admin Global" },
    };
    return badges[role] || badges.client;
  };

  const roleBadge = getRoleBadge(profile.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header avec gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white text-2xl shadow-md">
                  🎯
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Dashboard</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-white/90">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <span className="text-sm sm:text-base">{profile.email}</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${roleBadge.color} bg-white/20`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-3 rounded-xl transition-colors duration-200 active:opacity-80"
            >
              <span className="flex items-center gap-2">
                <span>🚪</span>
                <span>Déconnexion</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Navigation tabs */}
          <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200 p-2 sm:p-3">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {allowedSections.map((key) => {
                const section = SECTIONS[key];
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-r ${section.color} text-white shadow-md`
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="text-lg sm:text-xl">{section.icon}</span>
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="bg-white/90 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {ActiveComponent ? (
              <ActiveComponent />
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl mx-auto mb-4">
                  📭
                </div>
                <p className="text-slate-600 text-lg">Aucune section disponible pour ce rôle.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
