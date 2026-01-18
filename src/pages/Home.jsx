import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { FiSun, FiMoon, FiPlay, FiMenu, FiX } from "react-icons/fi";
import { 
  FaStarAndCrescent, 
  FaHandsPraying, 
  FaScaleBalanced, 
  FaUsers, 
  FaCalendarCheck, 
  FaMosque, 
  FaCertificate 
} from "react-icons/fa6";

// --- Sous-composant pour les éléments de la section "Concept" ---
const ConceptCard = ({ Icon, title, description }) => (
  <div className="flex flex-col items-center text-center p-6 mb-8 md:mb-0 hover:-translate-y-2 transition-transform duration-300">
    <div className="flex items-center justify-center w-[120px] h-[120px] rounded-full bg-gradient-to-l from-[#36b61c] to-[#a7e484] text-white text-4xl shadow-lg mb-6">
      <Icon />
    </div>
    <h5 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">{title}</h5>
    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed max-w-xs">
      {description}
    </p>
  </div>
);

// --- Sous-composant pour les Statistiques ---
const StatCard = ({ Icon, number, label, suffix = "" }) => (
  <div className="bg-white/10 p-8 rounded-3xl shadow-xl border border-white/20 backdrop-blur-md hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl flex flex-col items-center">
    <Icon className="text-5xl mb-4 text-white opacity-90" />
    <h2 className="text-4xl md:text-5xl font-bold mb-2 text-white">
      {number.toLocaleString()}{suffix}
    </h2>
    <p className="text-white font-medium opacity-90 text-sm uppercase tracking-wider">{label}</p>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();
  
  // États
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  // États pour l'animation des stats
  const [stats, setStats] = useState({ families: 0, years: 0, sacrifices: 0, satisfaction: 0 });
  const [hasAnimated, setHasAnimated] = useState(false);
  const statsRef = useRef(null); // Référence pour observer la section stats

  // Date d'ouverture : 14 avril 2025 à 10h00
  const openingDate = new Date(2025, 3, 14, 10, 0, 0).getTime();

  // 1. Gestion du Compteur (Countdown)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = openingDate - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Gestion de la Navbar au scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 3. Animation des statistiques au scroll (Intersection Observer)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          animateNumbers();
          setHasAnimated(true);
        }
      },
      { threshold: 0.3 } // Déclenche quand 30% de la section est visible
    );

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [hasAnimated]);

  const animateNumbers = () => {
    const targets = { families: 10000, years: 9, sacrifices: 10000, satisfaction: 100 };
    const duration = 2000;
    const steps = 60;
    const stepTime = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Easing function simple pour fluidifier (ease-out)
      const ease = 1 - Math.pow(1 - progress, 3); 

      setStats({
        families: Math.floor(targets.families * ease),
        years: Math.floor(targets.years * ease),
        sacrifices: Math.floor(targets.sacrifices * ease),
        satisfaction: Math.floor(targets.satisfaction * ease)
      });

      if (currentStep >= steps) {
        clearInterval(interval);
        setStats(targets);
      }
    }, stepTime);
  };

  return (
    <div className={`min-h-screen font-['Poppins',sans-serif] ${darkMode ? 'dark bg-slate-900' : 'bg-gray-50'}`}>
      
      {/* --- Navbar Flottante --- */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 px-6 py-4 ${isScrolled ? 'bg-white/90 dark:bg-slate-900/90 shadow-md backdrop-blur-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            {/* Logo placeholder */}
            <div className={`text-2xl font-bold ${isScrolled ? 'text-green-600' : 'text-white'}`}>
                GRAMMONT
            </div>
            
            {/* Dark Mode Toggle */}
            <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-full transition-all ${isScrolled ? 'bg-green-100 text-green-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
                aria-label="Toggle dark mode"
            >
                {darkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
            </button>
        </div>
      </nav>

      {/* --- Banner Section --- */}
      <section className="relative min-h-screen flex items-center pt-20 pb-20 px-6 overflow-hidden bg-gradient-to-br from-[#28a745] to-[#1e7e34]">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 -left-24 w-72 h-72 bg-[#a7e484]/20 rounded-full blur-2xl"></div>
        </div>

        <div className="container max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col-reverse md:flex-row items-center gap-12">
            
            {/* Texte Gauche */}
            <div className="w-full md:w-1/2 text-center md:text-left">
              <div className="p-8 md:p-12 rounded-3xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg">
                <span className="inline-block py-1 px-3 rounded-full bg-[#a7e484]/20 text-[#a7e484] border border-[#a7e484]/30 text-xs font-bold mb-4 uppercase tracking-wider">
                  Ouverture dans {countdown.days}j {countdown.hours}h
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Aïd al-Adha <br/> <span className="text-[#a7e484]">Serein & Sacré</span>
                </h1>
                <p className="text-gray-100 text-lg mb-8 leading-relaxed opacity-90">
                  Célébrez l'Aïd dans le respect strict des traditions et des normes sanitaires. 
                  Réservez votre créneau en toute tranquillité.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                    <button 
                    onClick={() => navigate("/auth")}
                    className="px-8 py-4 bg-[#a7e484] text-green-900 font-bold rounded-xl shadow-lg hover:bg-white hover:scale-105 transition-all duration-300"
                    >
                    Réserver maintenant
                    </button>
                    <button 
                    className="px-8 py-4 bg-transparent border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300"
                    onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth'})}
                    >
                    En savoir plus
                    </button>
                </div>
              </div>
            </div>

            {/* Image Droite */}
            <div className="w-full md:w-1/2 flex justify-center relative">
              <div className="relative z-10 w-[280px] md:w-[320px]">
                <img 
                  src="/static/images/iphone-screen.png" 
                  className="w-full h-auto drop-shadow-2xl animate-float" 
                  alt="Application Reservation"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
              
              {/* Logos Officiels Flottants */}
              <div className="absolute -bottom-10 md:bottom-0 left-0 right-0 flex justify-center gap-6 bg-white/90 backdrop-blur-sm py-4 px-6 rounded-2xl shadow-xl max-w-sm mx-auto z-20">
                 <img src="/static/images/logo-ddpp.png" alt="DDPP" className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" onError={(e) => e.target.style.display = 'none'} />
                 <div className="w-px bg-gray-300"></div>
                 <img src="/static/images/logo-montpellier.png" alt="Montpellier" className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" onError={(e) => e.target.style.display = 'none'} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- About Section --- */}
      <section id="about" className="py-24 px-6 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h3 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">Le Concept</h3>
            <div className="h-1 w-20 bg-[#a7e484] mx-auto rounded-full mb-6"></div>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              Une solution clé en main pour accomplir votre devoir religieux sans stress, 
              avec une traçabilité totale et un service premium.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ConceptCard 
              Icon={FaStarAndCrescent} 
              title="Respect du Rite" 
              description="Sacrifice réalisé strictement selon le rite musulman par des sacrificateurs agréés."
            />
            <ConceptCard 
              Icon={FaHandsPraying} 
              title="Ambiance Familiale" 
              description="Des espaces aménagés pour attendre confortablement avec vos proches."
            />
            <ConceptCard 
              Icon={FaScaleBalanced} 
              title="Conformité & Hygiène" 
              description="Installations modernes validées par la DDPP et respectant les normes européennes."
            />
          </div>
        </div>
      </section>

      {/* --- Stats Section --- */}
      <section ref={statsRef} className="py-24 px-6 bg-gradient-to-r from-[#28a745] to-[#218838]">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard Icon={FaUsers} number={stats.families} label="Familles Satisfaites" suffix="+" />
            <StatCard Icon={FaCalendarCheck} number={stats.years} label="Années d'Expérience" />
            <StatCard Icon={FaMosque} number={stats.sacrifices} label="Sacrifices Réalisés" suffix="+" />
            <StatCard Icon={FaCertificate} number={stats.satisfaction} label="Taux de Satisfaction" suffix="%" />
          </div>
        </div>
      </section>

      {/* --- Video Section --- */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gray-900/50 z-0">
             {/* Background image placeholder */}
             <div className="w-full h-full bg-[url('/static/images/crowd-bg.jpg')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#28a745]/90 to-[#28a745]/80 z-10"></div>
        
        <div className="container max-w-4xl mx-auto relative z-20 text-center text-white">
          <h3 className="text-4xl md:text-5xl font-bold mb-12">Ils parlent de nous</h3>
          
          <button
            onClick={() => setShowVideoPopup(true)}
            className="group relative w-24 h-24 mx-auto flex items-center justify-center bg-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-110"
            aria-label="Play video"
          >
            <span className="absolute inset-0 rounded-full bg-white opacity-20 animate-ping"></span>
            <FiPlay className="text-4xl text-[#28a745] ml-2 group-hover:scale-110 transition-transform" />
          </button>
          
          <p className="mt-8 text-lg font-medium opacity-90">Découvrez le reportage officiel sur l'organisation</p>
        </div>

        {/* Video Modal */}
        {showVideoPopup && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowVideoPopup(false)}
          >
            <div className="relative w-full max-w-4xl bg-black rounded-2xl shadow-2xl overflow-hidden border border-white/10">
              <button 
                onClick={() => setShowVideoPopup(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <FiX size={24} />
              </button>
              <div className="relative pb-[56.25%] h-0">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/Dsf3csUASlc?autoplay=1"
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Footer --- */}
      <footer className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-gray-800 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-bold text-[#28a745]">GRAMMONT</div>
          <p className="text-gray-500 text-sm text-center md:text-right">
            © {new Date().getFullYear()} Réservation Abattoir Aïd. Tous droits réservés.<br/>
            <span className="text-xs opacity-70">Développé avec soin pour la communauté.</span>
          </p>
        </div>
      </footer>
      
    </div>
  );
}