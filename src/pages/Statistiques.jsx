import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiPieChart, FiDollarSign, FiUsers, FiTrendingUp, FiCheckCircle } from "react-icons/fi";

export default function Statistiques() {
  const [stats, setStats] = useState({ commandes: 0, placesRestantes: 0, caisseAcompte: 0, caisseTotale: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchData() {
    try {
      const { data: commandes } = await supabase.from("commandes").select("*").in("statut", ["acompte_paye", "en_attente_caisse", "paye_integralement"]);
      const { data: creneaux } = await supabase.from("creneaux_horaires").select("capacite");
      
      let totalPlaces = 0;
      creneaux?.forEach(c => totalPlaces += c.capacite);

      if (commandes) {
        const acomptes = commandes.reduce((sum, cmd) => sum + (cmd.acompte_cents / 100), 0);
        const totalVentes = commandes.reduce((sum, cmd) => sum + (cmd.montant_total_cents / 100), 0);

        setStats({
          commandes: commandes.length,
          placesRestantes: Math.max(0, totalPlaces - commandes.length),
          caisseAcompte: acomptes,
          caisseTotale: totalVentes
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Calcul des statistiques en direct...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <FiPieChart className="text-blue-500" />
          Statistiques en temps réel
        </h2>
        <p className="text-slate-500 text-sm mt-1">Les chiffres se mettent à jour automatiquement à chaque paiement Stripe.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Moutons Vendus</p>
          <p className="text-4xl font-black text-slate-800 dark:text-white mt-2">{stats.commandes}</p>
          <div className="mt-4 text-sm text-blue-600 font-bold flex items-center gap-1"><FiCheckCircle /> Validés par Stripe</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Places Restantes</p>
          <p className="text-4xl font-black text-emerald-600 mt-2">{stats.placesRestantes}</p>
          <div className="mt-4 text-sm text-emerald-600 font-bold flex items-center gap-1"><FiUsers /> Stock en direct</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Acomptes Sécurisés</p>
          <p className="text-4xl font-black text-slate-800 dark:text-white mt-2">{stats.caisseAcompte.toFixed(2)} €</p>
          <div className="mt-4 text-sm text-purple-600 font-bold flex items-center gap-1"><FiDollarSign /> Argent sur Stripe</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-lg relative overflow-hidden group text-white">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chiffre d'Affaires Prévu</p>
          <p className="text-4xl font-black mt-2">{stats.caisseTotale.toFixed(2)} €</p>
          <div className="mt-4 text-sm text-slate-300 font-bold flex items-center gap-1"><FiTrendingUp /> Total avec la caisse finale</div>
        </div>
      </div>
    </div>
  );
}