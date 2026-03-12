import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiPieChart, FiDollarSign, FiUsers, FiCheckCircle, FiCreditCard, FiSmartphone } from "react-icons/fi";

export default function Statistiques() {
  const [stats, setStats] = useState({ commandes: 0, placesRestantes: 0, caStripe: 0, caGuichet: 0, caTotal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const subTx = supabase.channel('stats_realtime_tx')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historique_paiements' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(subTx); };
  }, []);

  async function fetchData() {
    try {
      // 1. Décompte des VRAIES commandes (hors panier vide ou annulé)
      const { data: commandes } = await supabase.from("commandes").select("id").neq("statut", "disponible").neq("statut", "brouillon").neq("statut", "annule");
      
      // 2. Capacité de l'abattoir
      const { data: creneaux } = await supabase.from("creneaux_horaires").select("capacite");
      let totalPlaces = 0;
      creneaux?.forEach(c => totalPlaces += c.capacite);

      // 3. Calcul exact depuis le registre comptable !
      const { data: paiements } = await supabase.from("historique_paiements").select("montant_cents, moyen_paiement");
      
      let stripe = 0;
      let guichet = 0;
      let totalNet = 0;

      if (paiements) {
        paiements.forEach(p => {
          const euros = p.montant_cents / 100;
          totalNet += euros; // Gère automatiquement les ajouts et annulations (négatifs)
          
          if (p.moyen_paiement === 'stripe') {
              stripe += euros;
          } else {
              guichet += euros;
          }
        });
      }

      setStats({
        commandes: commandes?.length || 0,
        placesRestantes: Math.max(0, totalPlaces - (commandes?.length || 0)),
        caStripe: stripe,
        caGuichet: guichet,
        caTotal: totalNet
      });
    } catch (err) { 
        console.error(err); 
    } finally { 
        setLoading(false); 
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Calcul des statistiques en direct...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
          <div className="p-3 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/30"><FiPieChart className="text-2xl" /></div>
          Tableau de Bord Exécutif
        </h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">Vue d'ensemble de l'activité, basée sur la comptabilité stricte.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group col-span-2 md:col-span-1 lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Moutons Vendus</p>
          <p className="text-4xl font-black text-slate-800 dark:text-white mt-2">{stats.commandes}</p>
          <div className="mt-4 text-xs text-blue-600 font-bold flex items-center gap-1"><FiCheckCircle /> Dossiers actifs</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group col-span-2 md:col-span-1 lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Places Restantes</p>
          <p className="text-4xl font-black text-emerald-600 mt-2">{stats.placesRestantes}</p>
          <div className="mt-4 text-xs text-emerald-600 font-bold flex items-center gap-1"><FiUsers /> Stock en temps réel</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recette Site Web</p>
          <p className="text-3xl font-black text-purple-600 mt-2">{stats.caStripe.toFixed(2)} €</p>
          <div className="mt-4 text-xs text-purple-600 font-bold flex items-center gap-1"><FiSmartphone /> Acomptes Stripe</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 relative overflow-hidden group lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/10 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recette Guichets</p>
          <p className="text-3xl font-black text-orange-600 mt-2">{stats.caGuichet.toFixed(2)} €</p>
          <div className="mt-4 text-xs text-orange-600 font-bold flex items-center gap-1"><FiCreditCard /> Encaissé par l'équipe</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black p-6 rounded-3xl shadow-xl relative overflow-hidden group text-white col-span-2 lg:col-span-1 border border-slate-800 flex flex-col justify-center">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chiffre d'Affaires Net</p>
          <p className="text-4xl font-black mt-2 text-emerald-400">{stats.caTotal.toFixed(2)} €</p>
        </div>

      </div>
    </div>
  );
}