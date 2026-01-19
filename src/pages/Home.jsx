import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { supabase } from "../lib/supabase"; 
import { 
  FiSun, FiMoon, FiPlay, FiX, FiArrowRight, FiCheck, 
  FiLogIn, FiLogOut, FiUser, FiChevronDown, FiBox, FiSettings 
} from "react-icons/fi";
import { 
  FaStarAndCrescent, 
  FaHandsPraying, 
  FaScaleBalanced, 
  FaUsers, 
  FaCalendarCheck, 
  FaMosque, 
  FaCertificate 
} from "react-icons/fa6";

/* --- STYLE CSS PERSONNALISÉ (INTÉGRÉ) --- */
const customStyles = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
    100% { transform: translateY(0px); }
  }
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-blob { animation: blob 7s infinite; }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  
  .glass-panel {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .glass-card-hover:hover {
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-5px);
  }
`;

// --- COMPOSANTS UI ---

const BlobBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
    <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
  </div>
);

const ConceptCard = ({ Icon, title, description, index }) => (
  <div 
    className="group relative glass-panel p-8 rounded-3xl transition-all duration-500 glass-card-hover overflow-hidden"
    style={{ animationDelay: `${index * 150}ms` }}
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
    
    <div className="relative z-10">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white text-3xl shadow-lg shadow-green-500/30 mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon />
      </div>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

const StatCard = ({ Icon, number, label, suffix = "" }) => (
  <div className="text-center group">
    <div className="relative inline-block">
        <div className="absolute inset-0 bg-green-500 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
        <Icon className="text-5xl mb-4 text-green-600 dark:text-green-400 relative z-10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
    </div>
    <h2 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">
      {number.toLocaleString()}<span className="text-green-500">{suffix}</span>
    </h2>
    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-widest">{label}</p>
  </div>
);

const CountdownUnit = ({ value, label }) => (
  <div className="flex flex-col items-center glass-panel px-4 py-3 rounded-xl min-w-[80px]">
    <span className="text-3xl font-bold text-white font-mono">{String(value).padStart(2, '0')}</span>
    <span className="text-[10px] uppercase tracking-widest text-green-200 mt-1">{label}</span>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();
  
  // États
  const [currentUser, setCurrentUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // État du menu
  const menuRef = useRef(null); // Référence pour le clic extérieur

  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [stats, setStats] = useState({ families: 0, years: 0, sacrifices: 0, satisfaction: 0 });
  const statsRef = useRef(null);

  const openingDate = new Date(2025, 3, 14, 10, 0, 0).getTime();

  useEffect(() => {
    // Auth Check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    // Gestion du clic extérieur pour fermer le menu
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // Countdown
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const diff = openingDate - now;
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    }, 1000);

    // Scroll
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    // Stats
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            animateStats();
            observer.disconnect();
        }
    }, { threshold: 0.5 });
    
    if (statsRef.current) observer.observe(statsRef.current);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
      clearInterval(timer);
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    navigate("/");
  };

  const animateStats = () => {
    const targets = { families: 10000, years: 9, sacrifices: 10000, satisfaction: 100 };
    const duration = 2000;
    const steps = 60;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setStats({
        families: Math.floor(targets.families * ease),
        years: Math.floor(targets.years * ease),
        sacrifices: Math.floor(targets.sacrifices * ease),
        satisfaction: Math.floor(targets.satisfaction * ease)
      });
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-green-500 selection:text-white ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'} transition-colors duration-500 overflow-x-hidden`}>
      <style>{customStyles}</style>

      {/* --- NAVBAR FLOTTANTE --- */}
      <nav 
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-in-out px-4 sm:px-8 py-4 ${
          scrolled 
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-black/5' 
          : 'bg-transparent pt-6'
        }`}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            
            {/* LOGO */}
            <div className={`text-2xl font-black tracking-tighter flex items-center gap-2 ${scrolled ? 'text-slate-800 dark:text-white' : 'text-white'}`}>
                <div className="w-8 h-8 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-lg flex items-center justify-center text-white text-xs">
                    G
                </div>
                GRAMMONT
            </div>
            
            {/* ACTIONS DROITE */}
            <div className="flex items-center gap-4">
                
                {/* --- MENU UTILISATEUR (DROPDOWN) --- */}
                {currentUser ? (
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`hidden sm:flex items-center gap-3 px-2 pl-3 py-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer hover:shadow-lg ${
                                scrolled 
                                ? 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800' 
                                : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                            }`}
                        >
                            <div className="p-1.5 bg-green-500 rounded-full text-white">
                                <FiUser className="text-sm" />
                            </div>
                            <div className="flex flex-col items-start text-xs leading-none pr-1">
                                <span className="opacity-70 font-medium">Bonjour</span>
                                <span className="font-bold max-w-[100px] truncate">{currentUser.email?.split('@')[0]}</span>
                            </div>
                            <FiChevronDown className={`ml-1 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mon Compte</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentUser.email}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left">
                                        <FiSettings className="text-indigo-500" /> Mon Espace
                                    </button>
                                    <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left">
                                        <FiBox className="text-green-500" /> Mes Commandes
                                    </button>
                                </div>
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-left">
                                        <FiLogOut /> Se déconnecter
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button 
                        onClick={() => navigate("/auth")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg hover:scale-105 active:scale-95 ${
                            scrolled 
                            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900' 
                            : 'bg-white text-green-900 hover:bg-green-50'
                        }`}
                    >
                        <FiLogIn />
                        <span>Se connecter</span>
                    </button>
                )}

                {/* --- THEME TOGGLE --- */}
                <button
                    onClick={toggleDarkMode}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        scrolled 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700' 
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'
                    }`}
                >
                    {darkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
                </button>
            </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
        
        {/* Fond dégradé animé */}
        <div className="absolute inset-0 bg-slate-900">
             <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 opacity-80"></div>
             <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
             <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] bg-purple-500/20 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-4000"></div>
             <div className="absolute inset-0 bg-[url('/static/images/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
        </div>

        <div className="container max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
            
            {/* Colonne Texte */}
            <div className="w-full lg:w-1/2 space-y-8 text-center lg:text-left animate-fade-in-up">
                
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border-green-500/30">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-green-300 text-xs font-bold uppercase tracking-wider">
                        Ouverture des réservations
                    </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
                  L'Aïd al-Adha <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200">
                    Serein & Sacré
                  </span>
                </h1>
                
                <p className="text-lg text-slate-300 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  Une solution clé en main respectant strictement le rite et les normes sanitaires. Réservez votre créneau en toute tranquillité.
                </p>

                <div className="flex justify-center lg:justify-start gap-3">
                    <CountdownUnit value={countdown.days} label="Jours" />
                    <CountdownUnit value={countdown.hours} label="Heures" />
                    <CountdownUnit value={countdown.minutes} label="Min" />
                    <CountdownUnit value={countdown.seconds} label="Sec" />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                    <button 
                        onClick={() => navigate(currentUser ? "/dashboard" : "/auth")}
                        className="group relative px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl font-bold text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/50 hover:scale-105 transition-all duration-300 w-full sm:w-auto overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out skew-x-12 -translate-x-full"></div>
                        <span className="relative flex items-center justify-center gap-2">
                           {currentUser ? "Accéder à mon espace" : "Réserver maintenant"} <FiArrowRight />
                        </span>
                    </button>
                    <button 
                         onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth'})}
                        className="px-8 py-4 rounded-2xl font-bold text-white border border-white/20 hover:bg-white/10 transition-all w-full sm:w-auto"
                    >
                        En savoir plus
                    </button>
                </div>
            </div>

            {/* Colonne Visuel 3D */}
            <div className="w-full lg:w-1/2 flex justify-center relative perspective-1000">
                <div className="relative w-[300px] md:w-[360px] animate-float z-10">
                    <div className="absolute inset-0 bg-gradient-to-tr from-green-500 to-emerald-300 rounded-[3rem] rotate-6 opacity-30 blur-2xl"></div>
                    <img 
                      src="/static/images/iphone-screen.png" 
                      className="relative z-10 w-full drop-shadow-2xl rounded-[3rem] border-8 border-slate-900 bg-slate-800"
                      alt="Application Mobile"
                      onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none'; 
                          e.target.parentNode.innerHTML = '<div class="h-[600px] w-full bg-slate-800 rounded-[3rem] flex items-center justify-center text-white border-8 border-slate-900 shadow-2xl"><span class="text-6xl">📱</span></div>';
                      }}
                    />
                    
                    <div className="absolute top-20 -left-12 glass-panel p-4 rounded-2xl flex items-center gap-3 animate-float animation-delay-2000 shadow-lg">
                        <div className="bg-green-500 p-2 rounded-lg text-white"><FiCheck /></div>
                        <div>
                            <p className="text-xs text-slate-300">Statut</p>
                            <p className="text-white font-bold text-sm">Validé DDPP</p>
                        </div>
                    </div>

                    <div className="absolute bottom-32 -right-8 glass-panel p-4 rounded-2xl flex items-center gap-3 animate-float animation-delay-4000 shadow-lg">
                        <div className="bg-orange-500 p-2 rounded-lg text-white"><FiPlay /></div>
                        <div>
                            <p className="text-xs text-slate-300">Live</p>
                            <p className="text-white font-bold text-sm">Abattoir Cam</p>
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- CONCEPT SECTION --- */}
      <section id="about" className="py-24 px-6 relative bg-white dark:bg-slate-900 transition-colors">
        <BlobBackground />
        
        <div className="container max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto space-y-4">
            <h2 className="text-base font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">
              Pourquoi nous choisir ?
            </h2>
            <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">
              L'Excellence du Service
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Nous avons repensé l'expérience de l'Aïd pour allier tradition prophétique et confort moderne.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ConceptCard 
              index={1}
              Icon={FaStarAndCrescent} 
              title="Respect du Rite" 
              description="Sacrifice réalisé strictement selon le rite musulman par des sacrificateurs agréés par la Grande Mosquée."
            />
            <ConceptCard 
              index={2}
              Icon={FaHandsPraying} 
              title="Confort Familial" 
              description="Des espaces d'attente aménagés, des écrans de suivi et une organisation fluide pour éviter l'attente."
            />
            <ConceptCard 
              index={3}
              Icon={FaScaleBalanced} 
              title="Traçabilité Totale" 
              description="Chaque bête est identifiée. Suivez votre commande de la réservation jusqu'au retrait via l'application."
            />
          </div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section ref={statsRef} className="py-24 bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700/50">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
            <StatCard Icon={FaUsers} number={stats.families} label="Familles" suffix="+" />
            <StatCard Icon={FaCalendarCheck} number={stats.years} label="Ans d'expérience" />
            <StatCard Icon={FaMosque} number={stats.sacrifices} label="Sacrifices" suffix="+" />
            <StatCard Icon={FaCertificate} number={stats.satisfaction} label="Satisfaction" suffix="%" />
          </div>
        </div>
      </section>

      {/* --- VIDEO SECTION --- */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-fixed bg-cover bg-center bg-[url('https://images.unsplash.com/photo-1542601906990-24d4c16419d9?q=80&w=2000&auto=format&fit=crop')] transform scale-105 filter brightness-50"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto space-y-8">
          <h3 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-lg">
            Vivez l'expérience <br/>
            <span className="text-green-400">en images</span>
          </h3>
          
          <button
            onClick={() => setShowVideoPopup(true)}
            className="group relative inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-md rounded-full border border-white/30 hover:scale-110 transition-all duration-300"
          >
             <span className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-ping"></span>
             <FiPlay className="text-3xl text-white ml-2 group-hover:text-green-400 transition-colors" />
          </button>
          <p className="text-slate-300 font-medium tracking-wide uppercase text-sm">Regarder le reportage officiel</p>
        </div>
      </section>

      {/* --- MODAL VIDEO --- */}
      {showVideoPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <button 
              onClick={() => setShowVideoPopup(false)}
              className="absolute top-6 right-6 z-20 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-all hover:rotate-90"
            >
              <FiX size={24} />
            </button>
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/Dsf3csUASlc?autoplay=1"
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-16 pb-8">
        <div className="container max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
                <div className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white">
                    GRAMMONT
                </div>
                <div className="flex gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <a href="#" className="hover:text-green-500 transition-colors">À propos</a>
                    <a href="#" className="hover:text-green-500 transition-colors">Tarifs</a>
                    <a href="#" className="hover:text-green-500 transition-colors">FAQ</a>
                    <a href="#" className="hover:text-green-500 transition-colors">Contact</a>
                </div>
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400">
                <p>&copy; {new Date().getFullYear()} Abattoir Grammont. Tous droits réservés.</p>
                <p>Développé avec ❤️ pour la communauté.</p>
            </div>
        </div>
      </footer>
      
    </div>
  );
}