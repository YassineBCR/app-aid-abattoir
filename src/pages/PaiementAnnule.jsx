import { Link } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiShoppingCart } from "react-icons/fi";

export default function PaiementAnnule() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-lg w-full text-center animate-fade-in-up">
        <FiAlertCircle className="text-5xl text-orange-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Paiement Interrompu</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-4">
          Vous n'avez pas été débité. Bonne nouvelle : <strong>votre panier est conservé</strong> jusqu'à la fin de votre chronomètre (10 minutes max).
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl hover:bg-slate-200 transition-colors" to="/">
              <FiArrowLeft /> Accueil
            </Link>
            <Link className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 transition-colors" to="/reservation">
              <FiShoppingCart /> Reprendre mon panier
            </Link>
        </div>
      </div>
    </div>
  );
}