import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiBarChart2, FiRefreshCw, FiDownload, FiSearch, FiFilter, FiDollarSign } from "react-icons/fi";

export default function Tableau() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres
  const [filterStatut, setFilterStatut] = useState("all");
  const [search, setSearch] = useState("");

  // Constante Prix (à dynamiser plus tard si besoin)
  const PRIX_TOTAL_CENTS = 25000; 

  async function fetchAllCommandes() {
    setLoading(true);
    // On récupère tout : commandes + infos créneaux
    const { data, error } = await supabase
      .from("commandes")
      .select(`
        *,
        creneaux_horaires ( date, heure_debut, heure_fin, jour )
      `)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      showNotification("Erreur chargement : " + error.message, "error");
    } else {
      setRows(data ?? []);
    }
  }

  useEffect(() => {
    fetchAllCommandes();
  }, []);

  // --- CALCULS & STATISTIQUES ---
  const stats = useMemo(() => {
    const validOrders = rows.filter(r => r.statut !== 'annulee' && r.statut !== 'refusee');
    const totalVendu = validOrders.length;
    const acompteTotal = validOrders.reduce((acc, r) => acc + (r.acompte_cents || 0), 0);
    
    // Estimation du reste à percevoir (sur les commandes non encore "livrées/soldées")
    // Si 'livree', on considère que tout est payé. Sinon, il reste (Total - Acompte).
    const resteAPercevoir = validOrders.reduce((acc, r) => {
        if (r.statut === 'livree') return acc; // Déjà payé
        return acc + (PRIX_TOTAL_CENTS - (r.acompte_cents || 0));
    }, 0);

    return { totalVendu, acompteTotal, resteAPercevoir };
  }, [rows]);

  // --- FILTRAGE DES DONNÉES ---
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Filtre Texte (Nom, Email, Ticket)
      const s = search.toLowerCase();
      const matchText = 
        (r.contact_last_name || "").toLowerCase().includes(s) ||
        (r.ticket_num || "").includes(s) ||
        (r.contact_email || "").toLowerCase().includes(s);

      // Filtre Statut
      const matchStatut = filterStatut === "all" || r.statut === filterStatut;

      return matchText && matchStatut;
    });
  }, [rows, search, filterStatut]);

  // --- EXPORT CSV ---
  const downloadCSV = () => {
    const headers = ["ID Commande", "Ticket", "Statut", "Nom", "Prénom", "Téléphone", "Email", "Date Créneau", "Heure", "Acompte (€)"];
    const csvContent = [
      headers.join(";"),
      ...filteredRows.map(r => [
        r.id,
        r.ticket_num,
        r.statut,
        r.contact_last_name,
        r.contact_first_name,
        r.contact_phone,
        r.contact_email,
        r.creneaux_horaires?.date,
        r.creneaux_horaires?.heure_debut,
        (r.acompte_cents / 100).toFixed(2)
      ].join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export_commandes_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <FiBarChart2 className="text-3xl text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tableau de Bord</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Vue d'ensemble des commandes</p>
        </div>
      </div>

      {/* 1. CARTES KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Bêtes Réservées</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.totalVendu}</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-lg">
          <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-2">
            <FiDollarSign className="text-base" />
            Acomptes Encaissés
          </div>
          <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">{(stats.acompteTotal / 100).toLocaleString()} €</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-lg">
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">Reste à percevoir</div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{(stats.resteAPercevoir / 100).toLocaleString()} €</div>
        </div>
      </div>

      {/* 2. BARRE D'OUTILS */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-initial relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Rechercher (Nom, Ticket...)" 
                className="pl-10 pr-4 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 w-full md:w-64 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <select 
                className="pl-10 pr-8 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors appearance-none cursor-pointer"
                value={filterStatut}
                onChange={e => setFilterStatut(e.target.value)}
              >
                <option value="all">Tous les statuts</option>
                <option value="paiement_recu">Payé (Acompte)</option>
                <option value="livree">Livrée (Terminée)</option>
                <option value="en_attente">En attente</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={fetchAllCommandes} 
              disabled={loading}
              className="bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button 
              onClick={downloadCSV} 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <FiDownload className="text-lg" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. TABLEAU DES DONNÉES */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">Ticket</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Client</th>
                <th className="p-4">Créneau</th>
                <th className="p-4">Montant</th>
                <th className="p-4 text-right">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 dark:text-slate-400">
                    Aucune commande trouvée.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">#{r.ticket_num}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold
                        ${r.statut === 'livree' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 
                          r.statut === 'paiement_recu' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          r.statut === 'annulee' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                        {r.statut.toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.contact_last_name} {r.contact_first_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{r.contact_phone}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {r.creneaux_horaires ? (
                        <>
                          {new Date(r.creneaux_horaires.date).toLocaleDateString()}<br/>
                          <span className="text-xs">{String(r.creneaux_horaires.heure_debut).slice(0,5)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{(r.acompte_cents / 100).toFixed(2)} €</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">{r.id.slice(0,8)}...</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
          <span>Affichage de {filteredRows.length} sur {rows.length} commandes</span>
        </div>
      </div>
    </div>
  );
}