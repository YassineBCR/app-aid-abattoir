import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext"; // 👈 Pour le son et les notifs
import { 
  FiCalendar, FiPackage, FiClock, FiBarChart2, FiFileText, 
  FiUser, FiLogOut, FiMail, FiSun, FiMoon, FiSettings
} from "react-icons/fi";

// IMPORTS DES PAGES
import Client from "./Client";
import Vendeur from "./Vendeur"; // C'est ici que se trouve maintenant la Réception + Caisse
import Tableau from "./Tableau";
import AdminSite from "./AdminSite";
import Stock from "./Stock";
import AdminAgneaux from "./Adminagneaux";
import AdminSMS from "./AdminSMS";
// import AdminGlobal from "./AdminGlobal"; // Décommente si tu utilises ce fichier

const SECTIONS = {
  // Client
  reserver: { label: "Réserver", component: Client, Icon: FiCalendar, color: "from-green-500 to-emerald-600" },
  
  // Admin : Gestion Principale (Tout est dans Vendeur.jsx maintenant)
  caisse: { label: "Gestion & Caisse", component: Vendeur, Icon: FiPackage, color: "from-blue-600 to-indigo-600" },
  
  // Admin : Suivi & Stats
  tableau: { label: "Tableau de Bord", component: Tableau, Icon: FiBarChart2, color: "from-cyan-500 to-blue-600" },
  
  // Admin : Paramétrage
  stock: { label: "Stock Tickets", component: Stock, Icon: FiFileText, color: "from-purple-500 to-violet-600" },
  creneaux: { label: "Créneaux", component: AdminSite, Icon: FiClock, color: "from-emerald-500 to-green-600" },
  agneaux: { label: "Agneaux & Tarifs", component: AdminAgneaux, Icon: FiUser, color: "from-orange-400 to-red-500" },
  
  // Outils
  sms: { label: "SMS & Marketing", component: AdminSMS, Icon: FiMail, color: "from-pink-500 to-rose-500" },
};

const PERMS = {
  client: { sections: ["reserver"] },
  vendeur: { sections: ["caisse", "tableau"] }, 
  // On a retiré "reception" car c'est inclus dans "caisse" (Vendeur.jsx)
  admin_site: { sections: ["caisse", "tableau", "creneaux", "stock", "agneaux", "sms"] },
  admin_global: { sections: ["caisse", "tableau", "creneaux", "stock", "agneaux", "sms"] },
};

export default function Dashboard() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  // 👇 On récupère les outils de notification et d'audio
  const { notifySystem, requestSystemPermission, enableAudio, audioEnabled } = useNotification(); 
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState(null);

  // --- 1. GESTION DES NOTIFICATIONS TEMPS RÉEL 🔔 ---
  useEffect(() => {
    // Si on n'est pas connecté ou simple client, on ne fait rien
    if (!profile || profile.role === 'client') return;

    // A. Demander la permission au navigateur (PC/Mobile)
    requestSystemPermission();

    // B. Écouter les nouvelles commandes en direct
    const channel = supabase
      .channel("toutes-commandes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commandes" },
        (payload) => {
          // C. DÉCLENCHER L'ALERTE SONORE + VISUELLE
          const nouveau = payload.new;
          notifySystem(
            "Nouvelle Commande ! 🐑", 
            `${nouveau.contact_first_name} ${nouveau.contact_last_name} (Ticket #${nouveau.ticket_num})`
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, requestSystemPermission, notifySystem]);


  // --- 2. CHARGEMENT PROFIL ---
  async function loadProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

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
      console.error("Erreur profil:", error);
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
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const allowedSections = useMemo(() => {
    if (!profile?.role) return [];
    return PERMS[profile.role]?.sections || [];
  }, [profile]);

  const ActiveComponent = active ? SECTIONS[active]?.component : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  if (!profile) {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          Connectez-vous pour accéder au dashboard.
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      
      {/* 🔴 ALERTE ACTIVATION SON (Seulement si admin et pas encore activé) */}
      {!audioEnabled && profile.role !== 'client' && (
        <div 
            className="bg-orange-600 text-white p-3 text-center cursor-pointer hover:bg-orange-700 transition-colors font-bold text-sm" 
            onClick={enableAudio}
        >
            ⚠️ Clique ici pour activer les alertes sonores (iPhone/Android) 🔔
        </div>
      )}

      {/* HEADER */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="font-bold text-xl tracking-tight">Bergerie Manager</div>
                <span className="px-2 py-0.5 rounded text-xs bg-white/20 font-mono">
                    {profile.role.replace('_', ' ').toUpperCase()}
                </span>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={toggleDarkMode} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                    {darkMode ? <FiSun /> : <FiMoon />}
                </button>
                <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-sm bg-red-600/80 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">
                    <FiLogOut /> <span className="hidden sm:inline">Sortir</span>
                </button>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* MENU NAVIGATION */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {allowedSections.map((key) => {
                const s = SECTIONS[key];
                const Icon = s.Icon;
                const isActive = active === key;
                return (
                    <button
                        key={key}
                        onClick={() => setActive(key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                            isActive 
                            ? `bg-gradient-to-r ${s.color} text-white shadow-md transform scale-105` 
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700"
                        }`}
                    >
                        <Icon className="text-lg" />
                        {s.label}
                    </button>
                )
            })}
        </div>

        {/* CONTENU PRINCIPAL */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[500px]">
            {ActiveComponent ? <ActiveComponent /> : <div className="p-10 text-center text-gray-500">Bienvenue sur votre espace.</div>}
        </div>
      </div>
    </div>
  );
}