import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";

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
      {/* 1. CARTES KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Bêtes Réservées</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.totalVendu}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Acomptes Encaissés</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{(stats.acompteTotal / 100).toLocaleString()} €</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Reste à percevoir (Jour J)</div>
          <div className="text-2xl font-bold text-orange-500 dark:text-orange-400">{(stats.resteAPercevoir / 100).toLocaleString()} €</div>
        </div>
      </div>

      {/* 2. BARRE D'OUTILS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
        <div className="flex gap-2 w-full md:w-auto">
            <input 
                type="text" 
                placeholder="Rechercher (Nom, Ticket...)" 
                className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-2 rounded-lg w-full md:w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <select 
                className="border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-2 rounded-lg"
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
        
        <div className="flex gap-2">
            <button onClick={fetchAllCommandes} className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-slate-200">🔄 Actualiser</button>
            <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold">
                📥 Exporter CSV
            </button>
        </div>
      </div>

      {/* 3. TABLEAU DES DONNÉES */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden border dark:border-slate-700">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                <th className="p-4">Ticket</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Client</th>
                <th className="p-4">Créneau</th>
                <th className="p-4">Montant</th>
                <th className="p-4 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">
                {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-600 dark:text-slate-400">Chargement...</td></tr>
                ) : filteredRows.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-500 dark:text-gray-400">Aucune commande trouvée.</td></tr>
                ) : (
                    filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="p-4 font-bold text-green-600 dark:text-green-400">#{r.ticket_num}</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                ${r.statut === 'livree' ? 'bg-gray-800 dark:bg-gray-700 text-white' : 
                                  r.statut === 'paiement_recu' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                  r.statut === 'annulee' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                  'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'}`}>
                                {r.statut.toUpperCase().replace('_', ' ')}
                            </span>
                        </td>
                        <td className="p-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{r.contact_last_name} {r.contact_first_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{r.contact_phone}</div>
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                            {r.creneaux_horaires ? (
                                <>
                                    {new Date(r.creneaux_horaires.date).toLocaleDateString()}<br/>
                                    {String(r.creneaux_horaires.heure_debut).slice(0,5)}
                                </>
                            ) : "—"}
                        </td>
                        <td className="p-4 text-slate-800 dark:text-slate-200">
                            {(r.acompte_cents / 100).toFixed(2)} €
                        </td>
                        <td className="p-4 text-right">
                             {/* Tu pourras ajouter ici un bouton "Voir détail" ou "Modifier" */}
                            <span className="text-gray-400 dark:text-gray-500 text-xs">{r.id.slice(0,6)}...</span>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-slate-700 border-t dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Affichage de {filteredRows.length} sur {rows.length} commandes</span>
        </div>
      </div>
    </div>
  );
}