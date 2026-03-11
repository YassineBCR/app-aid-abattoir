import { Link } from "react-router-dom";
import { FiXCircle, FiArrowLeft } from "react-icons/fi";

export default function PaiementAnnule() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
        <FiXCircle className="text-5xl text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Paiement Annulé</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Vous n'avez pas été débité et <strong>aucune place n'a été retirée du stock</strong>.
        </p>
        <Link className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mt-6" to="/dashboard">
          <FiArrowLeft /> Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}