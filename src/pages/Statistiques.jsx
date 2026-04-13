import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiPieChart, FiShoppingBag, FiDollarSign, 
  FiCheckCircle, FiTag, FiAlertCircle, FiCreditCard, FiAlertTriangle, FiClock, FiRefreshCw
} from "react-icons/fi";

// ─── Même logique que Tableau.jsx ─────────────────────────────────────────────
function getStatutMetier(cmd) {
  if (cmd.statut === "annule")  return "annule";
  if (cmd.statut === "bouclee") return "bouclee";
  const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
  const total    = (Number(cmd.montant_total_cents) || 0) / 100;
  const reste    = Math.max(0, total - dejaPaye);
  if (reste <= 0.05 && dejaPaye > 0) return "paye";
  if (dejaPaye > 0)                  return "reserve";
  return "attente";
}

export default function Statistiques() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    // Agneaux
    totalCommandes:  0,
    totalActifs:     0,   // hors annulés
    nonBoucles:      0,
    // Statuts (dérivés des montants — logique identique à Tableau.jsx)
    statusCounts: { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 },
    // Finances
    caTheorique:  0,
    caEncaisse:   0,
    // Moyens de paiement
    methodCounts: { especes: 0, cb: 0, stripe: 0 },
    // Catégories
    categorieCounts: {}
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // ── 1. Toutes les commandes (hors brouillons/en_attente) ──────────────
      let toutesLesCommandes = [];
      let from = 0, hasMore = true;
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('commandes')
          .select('*')
          .neq('statut', 'brouillon')
          .neq('statut', 'en_attente')
          .range(from, from + 999);
        if (error) throw error;
        if (batch && batch.length > 0) { toutesLesCommandes.push(...batch); from += 1000; }
        else hasMore = false;
      }

      // ── 2. Historique paiements guichet ───────────────────────────────────
      let tousLesPaiements = [];
      from = 0; hasMore = true;
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('historique_paiements')
          .select('*')
          .range(from, from + 999);
        if (error) throw error;
        if (batch && batch.length > 0) { tousLesPaiements.push(...batch); from += 1000; }
        else hasMore = false;
      }

      // ── 3. Calculs ────────────────────────────────────────────────────────
      let caTheoriqueCents = 0;
      let caEncaisseCents  = 0;
      let sCounts = { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 };
      let mCounts = { especes: 0, cb: 0, stripe: 0 };
      let cCounts = {};
      let totalNonBoucles = 0;

      toutesLesCommandes.forEach(cmd => {
        // ── CA ──
        // On exclut les annulés du CA théorique
        if (cmd.statut !== 'annule') {
          caTheoriqueCents += (Number(cmd.montant_total_cents) || 0);
        }
        const payeCents = Number(cmd.montant_paye_cents ?? cmd.acompte_cents ?? 0);
        caEncaisseCents += payeCents;

        // ── Stripe (acompte web de 100 €) ──
        if (cmd.panier_id && Number(cmd.acompte_cents) === 10000) {
          mCounts.stripe += 100;
        }

        // ── Statut métier (MÊME logique que Tableau.jsx) ──
        const statut = getStatutMetier(cmd);
        sCounts[statut] = (sCounts[statut] || 0) + 1;

        // ── Catégories (hors annulés) ──
        if (cmd.categorie && cmd.statut !== 'annule') {
          cCounts[cmd.categorie] = (cCounts[cmd.categorie] || 0) + 1;
        }

        // ── Non bouclés (hors annulés) ──
        if (!cmd.numero_boucle && cmd.statut !== 'annule') {
          totalNonBoucles++;
        }
      });

      // ── Paiements guichet (espèces / CB) ──
      tousLesPaiements.forEach(p => {
        const montantEuros = (Number(p.montant_cents) || 0) / 100;
        const moyen = String(p.moyen_paiement || '').toLowerCase().trim();
        if (moyen.includes('espece') || moyen.includes('espèces')) {
          mCounts.especes += montantEuros;
        } else if (moyen === 'cb' || moyen.includes('carte')) {
          mCounts.cb += montantEuros;
        }
      });

      // ── Total actifs = tout sauf annulés ──
      const totalActifs = sCounts.attente + sCounts.reserve + sCounts.paye + sCounts.bouclee;

      setStats({
        totalCommandes:  toutesLesCommandes.length,
        totalActifs,
        nonBoucles:      totalNonBoucles,
        caTheorique:     caTheoriqueCents / 100,
        caEncaisse:      caEncaisseCents  / 100,
        statusCounts:    sCounts,
        methodCounts:    mCounts,
        categorieCounts: cCounts,
      });

    } catch (err) {
      console.error("Erreur lors du calcul des statistiques :", err);
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

  const { statusCounts: s, methodCounts: m, totalActifs, nonBoucles, caTheorique, caEncaisse, categorieCounts } = stats;
  const pourcentageBoucle    = totalActifs > 0 ? (s.bouclee / totalActifs) * 100 : 0;
  const totalPayementsHistory = m.especes + m.cb + m.stripe;
  const resteAEncaisser      = Math.max(0, caTheorique - caEncaisse);

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
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Analyse globale — calculée en temps réel depuis tes commandes et paiements.</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition-all"
        >
          <FiRefreshCw /> Actualiser
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BLOC 1 — SUIVI PHYSIQUE DES AGNEAUX
         ══════════════════════════════════════════════════════════════ */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
        <FiShoppingBag className="text-blue-500"/> Suivi Physique des Agneaux
      </h3>

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Total commandés */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Total Agneaux Commandés</p>
              <h3 className="text-5xl font-black text-blue-600 mt-2">{totalActifs}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1">
                <FiAlertCircle/> + {s.annule} annulés non comptés
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-2xl"><FiShoppingBag /></div>
          </div>
        </div>

        {/* Non bouclés */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group border-t-4 border-red-500">
          <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase">Agneaux NON Bouclés</p>
              <h3 className="text-5xl font-black text-red-500 mt-2">{nonBoucles}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2">Bêtes à identifier en urgence</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-red-400 flex items-center justify-center text-2xl"><FiAlertTriangle /></div>
          </div>
        </div>

        {/* Bouclés */}
        <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-emerald-200 uppercase">Agneaux Bouclés (Prêts)</p>
              <h3 className="text-5xl font-black text-white mt-2">{s.bouclee}</h3>
              <p className="text-xs font-bold text-emerald-200 mt-2">Bêtes prêtes pour les clients</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl"><FiTag /></div>
          </div>
          <div className="w-full bg-emerald-800 h-2 rounded-full mt-4 overflow-hidden relative z-10">
            <div className="bg-white h-full transition-all duration-700" style={{ width: `${pourcentageBoucle}%` }}></div>
          </div>
          <p className="text-xs text-emerald-200 mt-1 font-bold relative z-10">{pourcentageBoucle.toFixed(1)}% bouclés</p>
        </div>
      </div>

      {/* ── Détail des 5 statuts ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6">
          Détail par statut — {totalActifs} agneaux actifs
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* En attente */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 text-slate-500 text-lg"><FiClock /></div>
              <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{s.attente}</span>
            </div>
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">En Attente</p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-slate-500 h-full transition-all duration-700" style={{ width: `${totalActifs ? (s.attente / totalActifs) * 100 : 0}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold">{totalActifs ? ((s.attente / totalActifs) * 100).toFixed(1) : 0}%</p>
          </div>

          {/* Réservés */}
          <div className="p-5 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-600 text-orange-500 text-lg"><FiCreditCard /></div>
              <span className="text-3xl font-black text-orange-700 dark:text-orange-400">{s.reserve}</span>
            </div>
            <p className="text-xs font-bold uppercase text-orange-600 dark:text-orange-500">Réservés</p>
            <div className="w-full bg-orange-100 dark:bg-orange-900/40 h-1.5 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full transition-all duration-700" style={{ width: `${totalActifs ? (s.reserve / totalActifs) * 100 : 0}%` }}></div>
            </div>
            <p className="text-[10px] text-orange-400 font-bold">{totalActifs ? ((s.reserve / totalActifs) * 100).toFixed(1) : 0}%</p>
          </div>

          {/* Totalement payés */}
          <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-600 text-blue-500 text-lg"><FiCheckCircle /></div>
              <span className="text-3xl font-black text-blue-700 dark:text-blue-400">{s.paye}</span>
            </div>
            <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-500">Totalement Payés</p>
            <div className="w-full bg-blue-100 dark:bg-blue-900/40 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${totalActifs ? (s.paye / totalActifs) * 100 : 0}%` }}></div>
            </div>
            <p className="text-[10px] text-blue-400 font-bold">{totalActifs ? ((s.paye / totalActifs) * 100).toFixed(1) : 0}%</p>
          </div>

          {/* Bouclés */}
          <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-600 text-emerald-500 text-lg"><FiTag /></div>
              <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{s.bouclee}</span>
            </div>
            <p className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-500">Bouclés</p>
            <div className="w-full bg-emerald-100 dark:bg-emerald-900/40 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${totalActifs ? (s.bouclee / totalActifs) * 100 : 0}%` }}></div>
            </div>
            <p className="text-[10px] text-emerald-400 font-bold">{totalActifs ? ((s.bouclee / totalActifs) * 100).toFixed(1) : 0}%</p>
          </div>

        </div>

        {/* Annulés en bas */}
        {s.annule > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-700 text-red-500"><FiAlertCircle /></div>
              <p className="text-sm font-bold text-red-600 dark:text-red-400 uppercase">Commandes Annulées</p>
            </div>
            <span className="text-2xl font-black text-red-700 dark:text-red-400">{s.annule}</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BLOC 2 — SUIVI FINANCIER
         ══════════════════════════════════════════════════════════════ */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white mt-4 flex items-center gap-2">
        <FiDollarSign className="text-emerald-500"/> Suivi Financier & Ventes
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CHIFFRE D'AFFAIRES */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">Chiffre d'Affaires</h3>

          {/* 3 métriques CA */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">CA Théorique</p>
              <p className="text-lg font-black text-slate-700 dark:text-white">{caTheorique.toFixed(0)} €</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">CA Encaissé</p>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{caEncaisse.toFixed(0)} €</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-800 text-center">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Reste à enc.</p>
              <p className="text-lg font-black text-orange-700 dark:text-orange-400">{resteAEncaisser.toFixed(0)} €</p>
            </div>
          </div>

          {/* Barres par moyen de paiement */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="font-bold flex items-center gap-2 dark:text-white text-sm"><FiCreditCard className="text-indigo-500"/> Web (Stripe)</span>
                <span className="font-black text-indigo-600">{m.stripe.toFixed(2)} €</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${totalPayementsHistory ? (m.stripe / totalPayementsHistory) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="font-bold flex items-center gap-2 dark:text-white text-sm"><FiDollarSign className="text-teal-500"/> Guichet: Espèces</span>
                <span className="font-black text-teal-600">{m.especes.toFixed(2)} €</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full transition-all duration-700" style={{ width: `${totalPayementsHistory ? (m.especes / totalPayementsHistory) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="font-bold flex items-center gap-2 dark:text-white text-sm"><FiCreditCard className="text-blue-500"/> Guichet: CB</span>
                <span className="font-black text-blue-600">{m.cb.toFixed(2)} €</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${totalPayementsHistory ? (m.cb / totalPayementsHistory) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* VENTES PAR CATÉGORIES */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">Ventes par Catégories</h3>
          <div className="space-y-4">
            {Object.keys(categorieCounts).length === 0 ? (
              <p className="text-slate-400 italic text-center py-10">Aucune catégorie vendue pour l'instant.</p>
            ) : (
              Object.entries(categorieCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg flex items-center justify-center font-black text-xl mr-4 border border-orange-200 dark:border-orange-800">
                      {cat}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Catégorie {cat}</p>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-orange-500 h-full transition-all duration-700" style={{ width: `${totalActifs ? (count / totalActifs) * 100 : 0}%` }}></div>
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