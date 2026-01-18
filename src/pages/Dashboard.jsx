import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiCalendar, FiPackage, FiClock, FiBarChart2, FiFileText, 
  FiUser, FiLogOut, FiTarget, FiMail, FiSun, FiMoon, FiCamera, FiBell, FiActivity, FiDollarSign, FiTag 
} from "react-icons/fi";

// IMPORT DES COMPOSANTS
import Client from "./Client";
import Vendeur from "./Vendeur";
import Creneaux from "./Creneaux";
import Tableau from "./Tableau";
import Stock from "./Stock";
import AdminAgneaux from "./Adminagneaux";
import AdminSMS from "./AdminSMS";
import PriseEnCharge from "./PriseEnCharge"; 
import AdminLogs from "./AdminLogs"; 
import AdminCaisse from "./AdminCaisse";
import Bouclage from "./Bouclage"; // <--- NOUVEL IMPORT

// ---- CONFIGURATION DES RÔLES ----
const PERMS = {
  client: { sections: ["reserver"] },
  // AJOUT DE "bouclage" pour le vendeur
  vendeur: { sections: ["commandes", "prise_en_charge", "bouclage", "tableau"] },
  admin_site: { sections: ["commandes", "creneaux", "tableau", "stock"] },
  // AJOUT DE "bouclage" pour l'admin global aussi
  admin_global: { sections: ["commandes", "prise_en_charge", "bouclage", "creneaux", "tableau", "stock", "agneaux", "sms", "logs", "finance"] },
};

const SECTIONS = {
  reserver: { label: "Réserver", component: Client, Icon: FiCalendar, color: "from-green-500 to-emerald-600" },
  commandes: { label: "Commandes", component: Vendeur, Icon: FiPackage, color: "from-green-600 to-teal-600" },
  prise_en_charge: { label: "Prise en Charge", component: PriseEnCharge, Icon: FiCamera, color: "from-indigo-500 to-purple-600" },
  // NOUVELLE SECTION BOUCLAGE
  bouclage: { label: "Bouclage", component: Bouclage, Icon: FiTag, color: "from-orange-500 to-amber-600" },
  creneaux: { label: "Créneaux", component: Creneaux, Icon: FiClock, color: "from-emerald-500 to-green-600" },
  tableau: { label: "Tableau", component: Tableau, Icon: FiBarChart2, color: "from-teal-500 to-cyan-600" },
  stock: { label: "Stock", component: Stock, Icon: FiFileText, color: "from-green-400 to-emerald-500" },
  agneaux: { label: "Agneaux & Tarifs", component: AdminAgneaux, Icon: FiUser, color: "from-emerald-600 to-teal-600" },
  sms: { label: "SMS & Marketing", component: AdminSMS, Icon: FiMail, color: "from-teal-400 to-green-500" },
  logs: { label: "Logs & Sécurité", component: AdminLogs, Icon: FiActivity, color: "from-gray-600 to-slate-700" },
  finance: { label: "Comptabilité", component: AdminCaisse, Icon: FiDollarSign, color: "from-yellow-500 to-orange-600" },
};

export default function Dashboard() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState(null);

  const sendTestNotification = async () => {
    const confirm = window.confirm("Envoyer une notification de test ?");
    if (!confirm) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Vous n'êtes pas connecté");
      const { error } = await supabase.from('notifications_queue').insert({
          user_id: user.id, title: "Test Réussi 🚀", body: "Le système fonctionne !", url: "/dashboard"
        });
      if (error) throw error;
      alert("Notification envoyée !");
    } catch (err) { alert("Erreur : " + err.message); }
  };

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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Connexion requise</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-200">
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-700 dark:via-emerald-700 dark:to-teal-700 shadow-lg safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 safe-x py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-md"><FiTarget className="text-xl" /></div>
                <h1 className="text-2xl font-extrabold text-white truncate">Dashboard</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-white/90 text-sm">
                <FiUser /> <span>{profile.email}</span> • <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase">{profile.role}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={sendTestNotification} className="bg-purple-500/30 hover:bg-purple-500/50 text-white p-2.5 rounded-xl border border-white/20"><FiBell /></button>
              <button onClick={toggleDarkMode} className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl">{darkMode ? <FiSun /> : <FiMoon />}</button>
              <button onClick={logout} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2"><FiLogOut /> Déco</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-2 sm:p-3">
            <div className="flex flex-wrap gap-2">
              {allowedSections.map((key) => {
                const section = SECTIONS[key];
                const Icon = section.Icon;
                return (
                  <button key={key} onClick={() => setActive(key)} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${active === key ? `bg-gradient-to-r ${section.color} text-white shadow-md` : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
                    <Icon /> {section.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {ActiveComponent ? <ActiveComponent /> : <div className="p-12 text-center text-slate-500">Aucune section active.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}