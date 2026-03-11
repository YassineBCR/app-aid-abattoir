import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiCalendar, FiPackage, FiClock, FiBarChart2, FiFileText, 
  FiUser, FiLogOut, FiTarget, FiMail, FiSun, FiMoon, FiCamera, FiBell, FiActivity, FiDollarSign, FiTag, FiPlayCircle, FiX, FiLayers,
  FiHome, FiSettings, FiPieChart, FiList 
} from "react-icons/fi";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// IMPORT DES COMPOSANTS
import Client from "./Client";
import Vendeur from "./Vendeur";
import Creneaux from "./Creneaux";
import Tableau from "./Tableau"; 
import Statistiques from "./Statistiques"; 
import Stock from "./Stock";
import AdminAgneaux from "./Adminagneaux";
import AdminSMS from "./AdminSMS";
import PriseEnCharge from "./PriseEnCharge"; // C'est maintenant le Guichet Unique !
import AdminLogs from "./AdminLogs"; 
import AdminCaisse from "./AdminCaisse";
import Bouclage from "./Bouclage";
import AdminSettings from "./AdminSettings";

// ---- CONFIGURATION DES RÔLES (Nettoyée de la Caisse séparée) ----
const PERMS = {
  client: { sections: ["reserver"] },
  vendeur: { sections: ["commandes", "prise_en_charge", "bouclage", "tableau"] },
  admin_site: { sections: ["commandes", "creneaux", "tableau", "statistiques", "stock"] },
  admin_global: { sections: ["commandes", "prise_en_charge", "bouclage", "reserver", "creneaux", "tableau", "statistiques", "stock", "agneaux", "sms", "logs", "finance", "settings"] },
};

// ---- CONFIGURATION DES ONGLETS ----
const SECTIONS = {
  reserver: { label: "Espace Client", component: Client, Icon: FiCalendar, color: "from-green-500 to-emerald-600", desc: "Interface de réservation pour le client." },
  commandes: { label: "Commandes", component: Vendeur, Icon: FiPackage, color: "from-green-600 to-teal-600", desc: "Historique en direct des réservations Stripe." },
  
  // Le Guichet Unique
  prise_en_charge: { label: "Guichet (Boucle + Caisse)", component: PriseEnCharge, Icon: FiCamera, color: "from-emerald-600 to-teal-700", desc: "Scan, attribution du mouton et encaissement final." },
  
  bouclage: { label: "Bouclage", component: Bouclage, Icon: FiTag, color: "from-orange-500 to-amber-600", desc: "Processus d'identification officiel." },
  creneaux: { label: "Créneaux", component: Creneaux, Icon: FiClock, color: "from-emerald-500 to-green-600", desc: "Configuration des horaires d'abattoir." },
  tableau: { label: "Registre", component: Tableau, Icon: FiList, color: "from-teal-500 to-cyan-600", desc: "Liste détaillée des commandes." },
  statistiques: { label: "Statistiques", component: Statistiques, Icon: FiPieChart, color: "from-blue-500 to-indigo-600", desc: "Chiffres et bilan financier en direct." },
  stock: { label: "Stock", component: Stock, Icon: FiFileText, color: "from-green-400 to-emerald-500", desc: "Gestion des stocks physiques." },
  agneaux: { label: "Agneaux & Tarifs", component: AdminAgneaux, Icon: FiUser, color: "from-emerald-600 to-teal-600", desc: "Configuration des prix et types." },
  sms: { label: "SMS & Marketing", component: AdminSMS, Icon: FiMail, color: "from-teal-400 to-green-500", desc: "Campagnes de communication." },
  logs: { label: "Logs & Sécurité", component: AdminLogs, Icon: FiActivity, color: "from-gray-600 to-slate-700", desc: "Traçabilité des actions utilisateurs." },
  finance: { label: "Comptabilité", component: AdminCaisse, Icon: FiDollarSign, color: "from-yellow-500 to-orange-600", desc: "Suivi des paiements et caisse." },
  settings: { label: "Paramètres", component: AdminSettings, Icon: FiSettings, color: "from-slate-600 to-slate-800", desc: "Gestion des utilisateurs et maintenance." },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState(null);
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  // --- LOGIQUE DE DÉMO ---
  const runDemoScenario = (scenarioType, targetSection = null) => {
    setShowDemoMenu(false);

    const driverConfig = {
      showProgress: true,
      animate: true,
      doneBtnText: 'Terminer',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
    };

    let steps = [];

    if (scenarioType === 'general') {
      steps = [
        { element: '#demo-header', popover: { title: 'Bienvenue sur la Beta 🚀', description: 'Ceci est le tableau de bord central. Son apparence change dynamiquement selon le rôle.' } },
        { element: '#demo-profile', popover: { title: 'Rôle Actuel', description: `Vous êtes connecté en tant que <span class="font-bold text-green-600">${profile?.role}</span>.` } },
        { element: '#demo-nav', popover: { title: 'Navigation Modulaire', description: 'Les onglets disponibles dépendent de vos permissions.' } },
        { element: '#demo-tools', popover: { title: 'Outils Rapides', description: 'Retour Site, Notifications, Dark Mode et Déconnexion.' } }
      ];
    } else if (scenarioType === 'section' && targetSection) {
      setActive(targetSection);
      
      setTimeout(() => {
        if (targetSection === 'reserver') {
           steps = [
            { element: `button[data-tab="reserver"]`, popover: { title: "Vue Client", description: "Interface vue par les clients inscrits." } },
            { element: '#client-creneaux', popover: { title: "Étape 1 : Créneaux", description: "Choix du créneau horaire (Stock réel)." } },
            { element: '#client-tarifs', popover: { title: "Étape 2 : Choix Agneau", description: "Sélection de la catégorie." } },
            { element: '#client-form', popover: { title: "Étape 3 : Infos", description: "Formulaire pré-rempli." },
              onHighlightStarted: (el) => { const i = document.getElementById('client-input-name'); if(i) i.value = "Jean Test"; }, 
              onDeselected: (el) => { const i = document.getElementById('client-input-name'); if(i) i.value = ""; }
            },
            { element: '#client-submit', popover: { title: "Paiement", description: "Accès à la passerelle de paiement." } }
           ];
        } else {
          const sectionInfo = SECTIONS[targetSection];
          steps = [
            { element: `button[data-tab="${targetSection}"]`, popover: { title: sectionInfo.label, description: sectionInfo.desc } },
            { element: '#demo-content', popover: { title: 'Zone de Travail', description: "Interface principale du module." } }
          ];
        }

        const driverObj = driver({ ...driverConfig, steps });
        driverObj.drive();
      }, 500);
      return;
    }

    const driverObj = driver({ ...driverConfig, steps });
    driverObj.drive();
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-200 relative">
      
      {/* MENU DEMO INTERACTIF */}
      {showDemoMenu && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><FiPlayCircle /> Mode Présentation</h2>
                <p className="text-white/90 text-sm mt-1">Choisissez une section à explorer</p>
              </div>
              <button onClick={() => setShowDemoMenu(false)} className="text-white/80 hover:text-white bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6 grid gap-3 max-h-[60vh] overflow-y-auto">
              <button 
                onClick={() => runDemoScenario('general')}
                className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-all text-left group"
              >
                <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <FiLayers size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Tour Général</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Présentation globale de l'interface.</p>
                </div>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Démos par onglet</p>

              {allowedSections.map((key) => {
                const section = SECTIONS[key];
                const Icon = section.Icon;
                return (
                  <button 
                    key={key} 
                    onClick={() => runDemoScenario('section', key)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${section.color} text-white shadow-sm`}>
                      <Icon />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{section.label}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1">{section.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-700 dark:via-emerald-700 dark:to-teal-700 shadow-lg safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 safe-x py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div id="demo-header" className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-md"><FiTarget className="text-xl" /></div>
                <h1 className="text-2xl font-extrabold text-white truncate">Dashboard</h1>
              </div>
              <div id="demo-profile" className="flex flex-wrap items-center gap-2 text-white/90 text-sm">
                <FiUser /> <span>{profile.email}</span> • <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase">{profile.role}</span>
              </div>
            </div>
            
            <div id="demo-tools" className="flex items-center gap-2">
              
              <button 
                onClick={() => navigate('/')} 
                className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl border border-white/20 flex items-center gap-2"
                title="Retour à l'accueil"
              >
                <FiHome /> <span className="hidden sm:inline font-medium text-sm">Site</span>
              </button>

              {profile.role === 'admin_global' && (
                <button 
                  onClick={() => setShowDemoMenu(true)} 
                  className="bg-yellow-400/90 hover:bg-yellow-500 text-yellow-900 font-bold px-3 py-2.5 rounded-xl border border-yellow-200/50 shadow-lg flex items-center gap-2 animate-pulse hover:animate-none transition-all transform hover:scale-105"
                >
                  <FiPlayCircle className="text-lg" /> 
                  <span className="hidden sm:inline">Démo</span>
                </button>
              )}
              
              <button onClick={sendTestNotification} className="bg-purple-500/30 hover:bg-purple-500/50 text-white p-2.5 rounded-xl border border-white/20"><FiBell /></button>
              <button onClick={toggleDarkMode} className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl">{darkMode ? <FiSun /> : <FiMoon />}</button>
              <button onClick={logout} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2"><FiLogOut /> Déco</button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-2 sm:p-3 overflow-x-auto no-scrollbar">
            <div id="demo-nav" className="flex flex-nowrap md:flex-wrap gap-2 min-w-max md:min-w-0">
              {allowedSections.map((key) => {
                const section = SECTIONS[key];
                const Icon = section.Icon;
                return (
                  <button 
                    key={key}
                    data-tab={key} 
                    onClick={() => setActive(key)} 
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${active === key ? `bg-gradient-to-r ${section.color} text-white shadow-md` : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`}
                  >
                    <Icon /> {section.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div id="demo-content" className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px]">
            {ActiveComponent ? <ActiveComponent /> : <div className="p-12 text-center text-slate-500">Aucune section active.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}