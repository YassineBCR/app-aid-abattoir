import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiList, FiSearch, FiDownload, FiCheckCircle, FiClock, FiCreditCard } from "react-icons/fi";

export default function Tableau() {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('table_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Affichage de toutes les ventes validées par Stripe
      const { data, error } = await supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut )`)
        .in("statut", ["acompte_paye", "en_attente_caisse", "paye_integralement"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCommandes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const exportToCSV = () => {
    const headers = ["Ticket", "Client", "Téléphone", "Email", "Sacrifice", "Boucle", "Date Retrait", "Acompte", "Payé Total", "Reste à payer", "Statut"];
    const rows = commandes.map(c => {
      const dejaPaye = (c.montant_paye_cents || c.acompte_cents) / 100;
      const total = c.montant_total_cents / 100;
      return [
          c.ticket_num,
          `${c.contact_last_name} ${c.contact_first_name}`,
          c.contact_phone,
          c.contact_email,
          c.sacrifice_name,
          c.numero_boucle || "-",
          c.creneaux_horaires ? `${new Date(c.creneaux_horaires.date).toLocaleDateString('fr-FR')} à ${c.creneaux_horaires.heure_debut.slice(0,5)}` : "-",
          `${(c.acompte_cents / 100).toFixed(2)} €`,
          `${dejaPaye.toFixed(2)} €`,
          `${Math.max(0, total - dejaPaye).toFixed(2)} €`,
          c.statut
      ]
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Registre_Abattoir.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCommandes = commandes.filter(c => 
    `${c.contact_last_name} ${c.contact_first_name} ${c.ticket_num} ${c.numero_boucle || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FiList className="text-teal-600" /> Registre Global
          </h2>
          <p className="text-slate-500 text-sm mt-1">Toutes les commandes du site, peu importe leur avancement au guichet.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 transition-shadow" />
          </div>
          <button onClick={exportToCSV} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-bold text-sm">
            <FiDownload /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Ticket</th>
                <th className="p-4">Client</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Retrait</th>
                <th className="p-4">Boucle</th>
                <th className="p-4 text-right">Reste à Payer</th>
                <th className="p-4 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 animate-pulse">Chargement du registre...</td></tr>
              ) : filteredCommandes.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Aucune commande enregistrée.</td></tr>
              ) : (
                filteredCommandes.map(cmd => {
                  const dejaPaye = (cmd.montant_paye_cents || cmd.acompte_cents) / 100;
                  const total = cmd.montant_total_cents / 100;
                  const reste = Math.max(0, total - dejaPaye);

                  return (
                    <tr key={cmd.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="p-4 font-bold text-teal-600">#{cmd.ticket_num}</td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800 dark:text-white">{cmd.contact_last_name} {cmd.contact_first_name}</p>
                        <p className="text-xs text-slate-500">Pour : {cmd.sacrifice_name}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-700 dark:text-slate-300">{cmd.contact_phone}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[150px]">{cmd.contact_email}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-slate-800 dark:text-white">{cmd.creneaux_horaires ? new Date(cmd.creneaux_horaires.date).toLocaleDateString('fr-FR') : "-"}</p>
                        <p className="text-xs text-slate-500">{cmd.creneaux_horaires ? cmd.creneaux_horaires.heure_debut.slice(0,5) : ""}</p>
                      </td>
                      <td className="p-4">
                        {/* Affichage d'un tiret discret s'il n'y a pas encore de boucle */}
                        {cmd.numero_boucle ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold border border-emerald-200">{cmd.numero_boucle}</span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-black text-slate-800 dark:text-white">
                        {reste > 0.05 ? `${reste.toFixed(2)} €` : <span className="text-emerald-500">Soldé</span>}
                      </td>
                      <td className="p-4 text-center">
                        {cmd.statut === 'paye_integralement' ? <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200"><FiCheckCircle /> Clôturé</div> :
                         cmd.statut === 'en_attente_caisse' ? <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200"><FiClock /> Dossier Ouvert</div> :
                         <div className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200"><FiCreditCard /> Nouveau</div>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}