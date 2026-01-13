import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { FiLogIn, FiSun, FiMoon, FiCalendar, FiShield, FiCreditCard, FiCheckCircle, FiArrowRight } from "react-icons/fi";

export default function Home() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const features = [
    {
      icon: FiCalendar,
      title: "Réservation en ligne",
      description: "Choisissez votre créneau en quelques clics, disponible 24/7"
    },
    {
      icon: FiShield,
      title: "Sécurisé et fiable",
      description: "Vos données sont protégées et votre réservation garantie"
    },
    {
      icon: FiCreditCard,
      title: "Paiement sécurisé",
      description: "Payez votre acompte en toute sécurité et recevez votre ticket"
    },
    {
      icon: FiCheckCircle,
      title: "Confirmation instantanée",
      description: "Recevez immédiatement votre numéro de ticket par email"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-slate-900 dark:via-green-950 dark:to-emerald-950 transition-colors duration-300">
      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleDarkMode}
          className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 hover:scale-110"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
        </button>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 dark:from-green-500/5 dark:to-emerald-500/5"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            {/* Logo/Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-2xl">
                  <FiCalendar className="text-4xl" />
                </div>
              </div>
            </div>

            {/* Titre principal */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-green-900 dark:text-green-100 leading-tight">
              Réservation
              <span className="block text-green-600 dark:text-green-400">Abattoir Aïd</span>
            </h1>

            {/* Sous-titre */}
            <p className="text-xl sm:text-2xl text-green-700 dark:text-green-300 max-w-3xl mx-auto leading-relaxed">
              Réservez votre créneau facilement, payez en toute sécurité et recevez votre ticket instantanément
            </p>

            {/* CTA Principal */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <button
                onClick={() => navigate("/auth")}
                className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-2xl hover:shadow-green-500/50 transition-all duration-300 flex items-center gap-3 hover:scale-105 transform"
              >
                <FiLogIn className="text-xl group-hover:translate-x-1 transition-transform" />
                <span>Se connecter</span>
                <FiArrowRight className="text-xl group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Décoration animée */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-green-50/50 dark:from-slate-900/50 to-transparent"></div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-900 dark:text-green-100 mb-4">
              Pourquoi nous choisir ?
            </h2>
            <p className="text-lg text-green-700 dark:text-green-300 max-w-2xl mx-auto">
              Un processus simple, rapide et sécurisé pour votre réservation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl hover:shadow-green-500/20 border border-green-100 dark:border-green-900/50 transition-all duration-300 hover:-translate-y-2 transform"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Icon className="text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-green-700 dark:text-green-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Prêt à réserver votre créneau ?
          </h2>
          <p className="text-xl text-green-50 max-w-2xl mx-auto">
            Rejoignez nos clients et bénéficiez d'un service rapide et fiable pour votre réservation
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="group bg-white text-green-600 hover:bg-green-50 px-10 py-5 rounded-2xl text-lg font-bold shadow-2xl hover:shadow-white/50 transition-all duration-300 flex items-center gap-3 mx-auto hover:scale-105 transform"
          >
            <FiLogIn className="text-xl group-hover:translate-x-1 transition-transform" />
            <span>Commencer maintenant</span>
            <FiArrowRight className="text-xl group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-green-900 dark:bg-slate-950 text-green-100 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-green-300 dark:text-green-400 mb-4">
            © {new Date().getFullYear()} Réservation Abattoir Aïd
          </p>
          <p className="text-sm text-green-400 dark:text-green-500">
            Accès réservé aux clients et vendeurs autorisés
          </p>
        </div>
      </footer>
    </div>
  );
}
