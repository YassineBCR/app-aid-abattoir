import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiSearch, FiDownload, FiFilter, FiPhone, FiMail, FiTag, FiHash, FiCalendar, FiClock
} from "react-icons/fi";
import * as XLSX from "xlsx"; 

export default function Tableau() {
  const [loading, setLoading] = useState(true);
  const [commandes, setCommandes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState("tous");

  useEffect(() => {
    fetchCommandes();
    const sub = supabase
      .channel('tableau-suivi')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => {
        fetchCommandes();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchCommandes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commandes")
        .select(`*, creneaux_horaires (date, heure_debut)`)
        .in("statut", ["validee", "paye", "terminee", "pret", "bouclee"]) 
        .order("ticket_num", { ascending: true });

      if (error) throw error;
      setCommandes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const exportToExcel = () => {
    const dataToExport = filteredCommandes.map(c => ({
      Ticket: c.ticket_num,
      Sacrifice: c.sacrifice_name || "Standard",
      Date: c.creneaux_horaires?.date || "Non défini",
      Heure: c.creneaux_horaires?.heure_debut ? c.creneaux_horaires.heure_debut.slice(0,5) : "-",
      Statut: c.statut,
      Client: `${c.contact_last_name} ${c.contact_first_name}`,
      Telephone: c.contact_phone,
      Email: c.contact_email,
      Boucle: c.numero_boucle || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suivi_Commandes");
    XLSX.writeFile(wb, "Suivi_Abattoir.xlsx");
  };

  const filteredCommandes = commandes.filter(cmd => {
    const matchesSearch = 
      (cmd.ticket_num?.toString().includes(searchTerm)) ||
      (cmd.contact_last_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cmd.contact_phone?.includes(searchTerm));
    const matchesStatut = statutFilter === "tous" ? true : cmd.statut === statutFilter;
    return matchesSearch && matchesStatut;
  });

  const getStatusBadge = (statut) => {
    switch (statut) {
      case "validee": return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Validé</span>;
      case "paye": return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Payé</span>;
      case "pret": return <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Prêt</span>;
      case "bouclee": return <span className="px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Bouclé</span>;
      case "terminee": return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Terminé</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">{statut}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Non défini";
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de Suivi</h1>
          <p className="text-slate-500 text-sm">Suivi temps réel des commandes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium">
            <FiDownload /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/>
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="text-slate-400" />
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white">
            <option value="tous">Tous</option>
            <option value="validee">Validé</option>
            <option value="paye">Payé</option>
            <option value="pret">Bouclé</option>
            <option value="terminee">Terminé</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-semibold">Ticket</th>
                <th className="p-4 font-semibold">Jour & Heure</th>
                <th className="p-4 font-semibold">Sacrifice</th>
                <th className="p-4 font-semibold">Client</th>
                <th className="p-4 font-semibold">Contact</th>
                <th className="p-4 font-semibold text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Chargement...</td></tr>
              ) : filteredCommandes.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">Aucune commande trouvée.</td></tr>
              ) : (
                filteredCommandes.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-mono text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        <FiHash className="text-sm opacity-50" />{cmd.ticket_num}
                      </div>
                      {cmd.numero_boucle && <div className="text-xs text-orange-600 font-bold flex items-center gap-1 mt-1"><FiTag/> {cmd.numero_boucle}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                           <FiCalendar className="text-indigo-500" /><span className="capitalize">{formatDate(cmd.creneaux_horaires?.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                           <FiClock /><span>{cmd.creneaux_horaires?.heure_debut ? cmd.creneaux_horaires.heure_debut.slice(0,5) : "-"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                        <FiTag className="text-slate-400" />{cmd.sacrifice_name || <span className="text-slate-400 italic">Standard</span>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{cmd.contact_last_name} {cmd.contact_first_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2"><FiPhone className="text-green-500" /><span>{cmd.contact_phone}</span></div>
                        <div className="flex items-center gap-2"><FiMail className="text-blue-500" /><span className="truncate max-w-[150px]">{cmd.contact_email}</span></div>
                      </div>
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(cmd.statut)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}