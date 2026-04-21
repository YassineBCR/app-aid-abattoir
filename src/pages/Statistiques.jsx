import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiPieChart, FiShoppingBag, FiDollarSign, 
  FiCheckCircle, FiTag, FiAlertCircle, FiCreditCard, FiAlertTriangle, FiClock, FiRefreshCw
} from "react-icons/fi";

// ─── Même logique que Tableau.jsx ──────────────────────────────────────────
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
    totalCommandes:  0,
    totalActifs:     0,
    nonBoucles:      0,
    statusCounts: { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 },
    caTheorique:  0,
    caEncaisse:   0,
    methodCounts: { especes: 0, cb: 0, stripe: 0 },
    categorieCounts: {}
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // ── 1. Toutes les commandes actives ────────────────────────────────
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
        if (batch && batch.length > 0) {
          toutesLesCommandes.push(...batch);
          from += 1000;
        } else hasMore = false;
      }

      // ── 2. Paiements depuis la table comptabilite ──────────────────────
      // On ne prend que les encaissements réels (pas les annulations, fonds, etc.)
      let tousLesPaiements = [];
      from = 0; hasMore = true;
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('comptabilite')
          .select('montant_cents, moyen_paiement')
          .eq('type_mouvement', 'encaissement')
          .range(from, from + 999);
        if (error) throw error;
        if (batch && batch.length > 0) {
          tousLesPaiements.push(...batch);
          from += 1000;
        } else hasMore = false;
      }

      // ── 3. Calculs ─────────────────────────────────────────────────────
      let caTheoriqueCents = 0;
      let caEncaisseCents  = 0;
      let sCounts = { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 };
      let mCounts = { especes: 0, cb: 0, stripe: 0 };
      let cCounts = {};
      let totalNonBoucles = 0;

      toutesLesCommandes.forEach(cmd => {
        if (cmd.statut !== 'annule') {
          caTheoriqueCents += (Number(cmd.montant_total_cents) || 0);
        }
        const payeCents = Number(cmd.montant_paye_cents ?? cmd.acompte_cents ?? 0);
        caEncaisseCents += payeCents;

        const statut = getStatutMetier(cmd);
        sCounts[statut] = (sCounts[statut] || 0) + 1;

        if (cmd.categorie && cmd.statut !== 'annule') {
          cCounts[cmd.categorie] = (cCounts[cmd.categorie] || 0) + 1;
        }

        if (!cmd.numero_boucle && cmd.statut !== 'annule') {
          totalNonBoucles++;
        }
      });

      // ── Moyens de paiement depuis comptabilite ──
      tousLesPaiements.forEach(p => {
        const montantEuros = (Number(p.montant_cents) || 0) / 100;
        const moyen = String(p.moyen_paiement || '').toLowerCase().trim();
        if (moyen === 'especes') {
          mCounts.especes += montantEuros;
        } else if (moyen === 'cb') {
          mCounts.cb += montantEuros;
        } else if (moyen === 'stripe_web' || moyen === 'stripe_guichet') {
          mCounts.stripe += montantEuros;
        }
      });

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
  const pourcentageBoucle       = totalActifs > 0 ? (s.bouclee / totalActifs) * 100 : 0;
  const totalPayementsHistory   = m.especes + m.cb + m.stripe;
  const resteAEncaisser         = Math.max(0, caTheorique - caEncaisse);

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
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Calculé en temps réel — paiements lus depuis la table <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs font-mono">comptabilite</code>.</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition-all"
        >
          <FiRefreshCw /> Actualiser
        </button>
      </div>

      {/* ════════════════════════════════════════════
         BLOC 1 — SUIVI PHYSIQUE DES AGNEAUX
         ════════════════════════════════════════════ */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
        <FiShoppingBag className="text-blue-500" /> Suivi Physique des Agneaux
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Total commandés */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Total Agneaux Commandés</p>
              <h3 className="text-5xl font-black text-blue-600 mt-2">{totalActifs}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1">
                <FiAlertCircle /> + {s.annule} annulés non comptés
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-2xl"><FiShoppingBag /></div>
          </div>
        </div>

        {/* Agneaux en Attente */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-slate-300/30 dark:bg-slate-600/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase">Agneaux en Attente</p>
              <h3 className="text-5xl font-black text-slate-700 dark:text-slate-200 mt-2">{s.attente}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2">Aucun paiement initié</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-2xl"><FiClock /></div>
          </div>
        </div>

        {/* Agneaux Réservés */}
        <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-3xl shadow-xl border border-orange-200 dark:border-orange-800/50 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-orange-600 dark:text-orange-500 uppercase">Agneaux Réservés</p>
              <h3 className="text-5xl font-black text-orange-600 dark:text-orange-500 mt-2">{s.reserve}</h3>
              <p className="text-xs font-bold text-orange-500/80 mt-2">Acompte versé</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-orange-200 dark:bg-orange-900/60 text-orange-600 dark:text-orange-400 flex items-center justify-center text-2xl"><FiCreditCard /></div>
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

      </div>

      {/* Détail des 5 statuts */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6">
          Détail par statut — {totalActifs} agneaux actifs
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "attente", label: "En Attente",       icon: <FiClock />,       bg: "bg-slate-50 dark:bg-slate-900",       bar: "bg-slate-500",   border: "border-slate-200 dark:border-slate-700"    },
            { key: "reserve", label: "Réservés",         icon: <FiCreditCard />,  bg: "bg-orange-50 dark:bg-orange-900/20",  bar: "bg-orange-500",  border: "border-orange-100 dark:border-orange-800/50"},
            { key: "paye",    label: "Totalement Payés", icon: <FiCheckCircle />, bg: "bg-blue-50 dark:bg-blue-900/20",      bar: "bg-blue-500",    border: "border-blue-100 dark:border-blue-800/50"   },
            { key: "bouclee", label: "Bouclés",          icon: <FiTag />,         bg: "bg-emerald-50 dark:bg-emerald-900/20", bar: "bg-emerald-500", border: "border-emerald-100 dark:border-emerald-800/50"},
          ].map(({ key, label, icon, bg, bar, border }) => (
            <div key={key} className={`p-5 rounded-2xl border ${bg} ${border} flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <div className={`p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border ${border} text-lg`}>{icon}</div>
                <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{s[key]}</span>
              </div>
              <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className={`${bar} h-full transition-all duration-700`} style={{ width: `${totalActifs ? (s[key] / totalActifs) * 100 : 0}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">{totalActifs ? ((s[key] / totalActifs) * 100).toFixed(1) : 0}%</p>
            </div>
          ))}
        </div>

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

      {/* ════════════════════════════════════════════
         BLOC 2 — SUIVI FINANCIER
         ════════════════════════════════════════════ */}
      <h3 className="text-xl font-black text-slate-800 dark:text-white mt-4 flex items-center gap-2">
        <FiDollarSign className="text-emerald-500" /> Suivi Financier & Ventes
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CHIFFRE D'AFFAIRES */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">
            Chiffre d'Affaires
          </h3>

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

          <div className="space-y-5">
            {[
              { key: 'stripe', label: 'Stripe (Web + Guichet)', color: 'bg-indigo-500', textColor: 'text-indigo-600' },
              { key: 'especes', label: 'Espèces (Guichet)',      color: 'bg-teal-500',   textColor: 'text-teal-600'   },
              { key: 'cb',      label: 'CB / TPE (Guichet)',      color: 'bg-blue-500',   textColor: 'text-blue-600'   },
            ].map(({ key, label, color, textColor }) => (
              <div key={key}>
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold flex items-center gap-2 dark:text-white text-sm">
                    <FiCreditCard className={textColor} /> {label}
                  </span>
                  <span className={`font-black ${textColor}`}>{m[key].toFixed(2)} €</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                  <div className={`${color} h-full transition-all duration-700`} style={{ width: `${totalPayementsHistory ? (m[key] / totalPayementsHistory) * 100 : 0}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VENTES PAR CATÉGORIES */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-700 pb-4">
            Ventes par Catégories
          </h3>
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