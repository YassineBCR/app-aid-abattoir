import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiPieChart, FiTrendingUp, FiShoppingBag, FiDollarSign, 
  FiCheckCircle, FiClock, FiTag, FiAlertCircle, FiCreditCard, FiAlertTriangle
} from "react-icons/fi";

export default function Statistiques() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCommandes: 0,
    totalActifs: 0,
    nonBoucles: 0,
    caTheorique: 0,
    caEncaisse: 0,
    resteAEncaisser: 0,
    statusCounts: {
      attente: 0,
      acompte: 0,
      paye: 0,
      bouclee: 0,
      annule: 0
    },
    methodCounts: {
      especes: 0,
      cb: 0,
      stripe: 0
    },
    categorieCounts: {}
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Récupérer TOUTES les commandes confirmées (on exclut en_attente = paniers abandonnés)
      let toutesLesCommandes = [];
      let fromCmd = 0;
      let toCmd = 999;
      let hasMoreCmd = true;

      while (hasMoreCmd) {
        const { data: commandesBatch, error: cmdError } = await supabase
          .from('commandes')
          .select('*')
          .neq('statut', 'disponible')
          .neq('statut', 'brouillon')
          .neq('statut', 'en_attente') // ✅ On exclut les paniers non payés
          .range(fromCmd, toCmd);

        if (cmdError) throw cmdError;

        if (commandesBatch && commandesBatch.length > 0) {
          toutesLesCommandes = [...toutesLesCommandes, ...commandesBatch];
          fromCmd += 1000;
          toCmd += 1000;
        } else {
          hasMoreCmd = false;
        }
      }

      // Récupérer TOUS les paiements
      let tousLesPaiements = [];
      let fromPay = 0;
      let toPay = 999;
      let hasMorePay = true;

      while (hasMorePay) {
        const { data: paiementsBatch, error: payError } = await supabase
          .from('historique_paiements')
          .select('*')
          .range(fromPay, toPay);

        if (payError) throw payError;

        if (paiementsBatch && paiementsBatch.length > 0) {
          tousLesPaiements = [...tousLesPaiements, ...paiementsBatch];
          fromPay += 1000;
          toPay += 1000;
        } else {
          hasMorePay = false;
        }
      }

      // Calculer les statistiques
      let caTheorique = 0;
      let caEncaisse = 0;
      let sCounts = { attente: 0, acompte: 0, paye: 0, bouclee: 0, annule: 0 };
      let mCounts = { especes: 0, cb: 0, stripe: 0 };
      let cCounts = {};

      toutesLesCommandes.forEach(cmd => {
        caTheorique += (Number(cmd.montant_total_cents) || 0);
        
        const payeCents = cmd.montant_paye_cents ?? cmd.acompte_cents ?? 0;
        caEncaisse += Number(payeCents);

        if (cmd.categorie && cmd.statut !== 'annule') {
          cCounts[cmd.categorie] = (cCounts[cmd.categorie] || 0) + 1;
        }

        if (cmd.statut === 'acompte_paye') sCounts.acompte++;
        else if (cmd.statut === 'paye_integralement' || cmd.statut === 'validee') sCounts.paye++;
        else if (cmd.statut === 'bouclee') sCounts.bouclee++;
        else if (cmd.statut === 'annule') sCounts.annule++;
        // Note: en_attente n'est plus compté ici
      });

      tousLesPaiements.forEach(p => {
        if (p.moyen_paiement === 'especes') mCounts.especes += Number(p.montant_cents);
        if (p.moyen_paiement === 'cb') mCounts.cb += Number(p.montant_cents);
        if (p.moyen_paiement === 'stripe') mCounts.stripe += Number(p.montant_cents);
      });

      const totalActifs = sCounts.acompte + sCounts.paye + sCounts.bouclee;
      const nonBoucles = totalActifs - sCounts.bouclee;

      setStats({
        totalCommandes: toutesLesCommandes.length,
        totalActifs: totalActifs,
        nonBoucles: nonBoucles,
        caTheorique: caTheorique / 100,
        caEncaisse: caEncaisse / 100,
        resteAEncaisser: Math.max(0, (caTheorique - caEncaisse) / 100),
        statusCounts: sCounts,
        methodCounts: mCounts,
        categorieCounts: cCounts
      });

    } catch (err) {
      console.error("Erreur de chargement des stats", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-pulse">
        <FiPieChart className="text-6xl text-rose-300 mb-4" />
        <p className="text-slate-500 font-bold text-xl">Calcul des statistiques en cours...</p>
      </div>
    );
  }

  const pourcentageEncaisse = stats.caTheorique > 0 ? (stats.caEncaisse / stats.caTheorique) * 100 : 0;
  const pourcentageBoucle = stats.totalActifs > 0 ? (stats.statusCounts.bouclee / stats.totalActifs) * 100 : 0;
  const totalPayementsHistory = (stats.methodCounts.especes + stats.methodCounts.cb + stats.methodCounts.stripe) / 100;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-lg shadow-rose-500/30">
              <FiPieChart className="text-2xl" />
            </div>
            Statistiques & Suivi
          </h2>
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Analyse globale — uniquement les réservations confirmées (acompte payé).</p>
        </div>
      </div>

      {/* TOP KPIs - SUIVI DES AGNEAUX */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white mt-8 flex items-center gap-2"><FiShoppingBag className="text-blue-500"/> Suivi Physique des Agneaux</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Total Agneaux Commandés</p>
              <h3 className="text-5xl font-black text-blue-600 mt-2">{stats.totalActifs}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1"><FiAlertCircle/> (+ {stats.statusCounts.annule} annulés)</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-2xl"><FiShoppingBag /></div>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group border-t-4 border-red-500">
          <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase">Agneaux NON Bouclés</p>
              <h3 className="text-5xl font-black text-red-500 mt-2">{stats.nonBoucles}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2">Bêtes à identifier en urgence</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-red-400 flex items-center justify-center text-2xl"><FiAlertTriangle /></div>
          </div>
        </div>

        <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-emerald-200 uppercase">Agneaux Bouclés (Prêts)</p>
              <h3 className="text-5xl font-black text-white mt-2">{stats.statusCounts.bouclee}</h3>
              <p className="text-xs font-bold text-emerald-200 mt-2">Bêtes prêtes pour les clients</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl"><FiTag /></div>
          </div>
          <div className="w-full bg-emerald-800 h-2 rounded-full mt-4 overflow-hidden relative z-10">
            <div className="bg-white h-full" style={{ width: `${pourcentageBoucle}%` }}></div>
          </div>
        </div>

      </div>

      {/* DETAIL DES STATUTS */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8 mt-6">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6">Détail du statut des agneaux commandés (hors paniers abandonnés)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          
          <div className="p-5 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 flex items-center gap-4">
             <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-600 text-orange-500 text-xl"><FiCreditCard /></div>
             <div>
                <p className="text-xs font-bold uppercase text-orange-600 dark:text-orange-500">Réservés (Acompte)</p>
                <h4 className="text-2xl font-black text-orange-700 dark:text-orange-400">{stats.statusCounts.acompte}</h4>
             </div>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 flex items-center gap-4">
             <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-600 text-blue-500 text-xl"><FiCheckCircle /></div>
             <div>
                <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-500">Totalement Payés</p>
                <h4 className="text-2xl font-black text-blue-700 dark:text-blue-400">{stats.statusCounts.paye}</h4>
             </div>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-4 shadow-inner">
             <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-600 text-emerald-500 text-xl"><FiTag /></div>
             <div>
                <p className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-500">Agneaux Bouclés</p>
                <h4 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{stats.statusCounts.bouclee}</h4>
             </div>
          </div>

        </div>
      </div>

      {/* GRAPHIQUES DETAILLES (Finances & Catégories) */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white mt-12 flex items-center gap-2"><FiDollarSign className="text-emerald-500"/> Suivi Financier & Ventes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">Chiffre d'Affaires</h3>
            
            <div className="flex justify-between items-end mb-8 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">C.A. Encaissé</p>
                    <p className="text-3xl font-black text-emerald-600">{stats.caEncaisse.toFixed(2)} €</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-orange-500 uppercase">Reste à encaisser</p>
                    <p className="text-xl font-black text-orange-600">{stats.resteAEncaisser.toFixed(2)} €</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="font-bold flex items-center gap-2 dark:text-white"><FiCreditCard className="text-indigo-500"/> Paiements Web (Stripe)</span>
                        <span className="font-black text-indigo-600">{(stats.methodCounts.stripe / 100).toFixed(2)} €</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${totalPayementsHistory ? (stats.methodCounts.stripe / 100 / totalPayementsHistory) * 100 : 0}%` }}></div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="font-bold flex items-center gap-2 dark:text-white"><FiDollarSign className="text-teal-500"/> Guichet: Espèces</span>
                        <span className="font-black text-teal-600">{(stats.methodCounts.especes / 100).toFixed(2)} €</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                        <div className="bg-teal-500 h-full" style={{ width: `${totalPayementsHistory ? (stats.methodCounts.especes / 100 / totalPayementsHistory) * 100 : 0}%` }}></div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="font-bold flex items-center gap-2 dark:text-white"><FiCreditCard className="text-blue-500"/> Guichet: CB</span>
                        <span className="font-black text-blue-600">{(stats.methodCounts.cb / 100).toFixed(2)} €</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${totalPayementsHistory ? (stats.methodCounts.cb / 100 / totalPayementsHistory) * 100 : 0}%` }}></div>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">Ventes par Catégories</h3>
            
            <div className="space-y-4">
                {Object.keys(stats.categorieCounts).length === 0 ? (
                    <p className="text-slate-400 italic text-center py-10">Aucune catégorie vendue pour l'instant.</p>
                ) : (
                    Object.entries(stats.categorieCounts).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, count]) => (
                        <div key={cat} className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                            <div className="w-12 h-12 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg flex items-center justify-center font-black text-xl mr-4 border border-orange-200 dark:border-orange-800">
                                {cat}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Catégorie {cat}</p>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-orange-500 h-full" style={{ width: `${(count / stats.totalActifs) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="ml-4 text-right">
                                <span className="text-2xl font-black text-slate-800 dark:text-white">{count}</span>
                                <span className="text-xs text-slate-400 block font-bold">agneaux</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>

    </div>
  );
}