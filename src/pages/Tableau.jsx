import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiList, FiSearch, FiDownload, FiCheckCircle, FiClock, FiCreditCard, FiAlertCircle, FiTag } from "react-icons/fi";

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
      const { data, error } = await supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut )`)
        .not("contact_last_name", "is", null)
        .neq("contact_last_name", "")
        .neq("statut", "disponible")
        .neq("statut", "brouillon")
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
      const dejaPaye = (c.montant_paye_cents || c.acompte_cents || 0) / 100;
      const total = (c.montant_total_cents || 0) / 100;
      const reste = Math.max(0, total - dejaPaye);
      
      // Traduction des statuts INFAILLIBLE basée sur les finances pour l'export Excel
      let statutFr = "En Attente";
      if (c.statut === 'annule') statutFr = 'Annulé';
      else if (c.statut === 'bouclee') statutFr = 'Bouclée';
      else if (reste <= 0.05 && dejaPaye > 0) statutFr = 'Totalement Payé';
      else if (dejaPaye > 0) statutFr = 'Réservé';

      return [
          c.ticket_num,
          `${c.contact_last_name} ${c.contact_first_name}`,
          c.contact_phone,
          c.contact_email,
          c.sacrifice_name,
          c.numero_boucle || c.ticket_num,
          c.creneaux_horaires ? `${new Date(c.creneaux_horaires.date).toLocaleDateString('fr-FR')} à ${c.creneaux_horaires.heure_debut.slice(0,5)}` : "-",
          `${(c.acompte_cents / 100).toFixed(2)} €`,
          `${dejaPaye.toFixed(2)} €`,
          `${reste.toFixed(2)} €`,
          statutFr
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

  // LOGIQUE METIER D'AFFICHAGE DES STATUTS (Basée sur l'argent réel encaissé)
  const renderStatut = (cmd) => {
    // 1. Les cas extrêmes (Annulé ou Bouclée)
    if (cmd.statut === 'annule') {
      return <div className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-300"><FiAlertCircle /> Annulé</div>;
    }
    if (cmd.statut === 'bouclee') {
      return <div className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-2 py-1 rounded shadow-md"><FiTag /> Bouclée</div>;
    }

    // Calculs financiers stricts
    const dejaPaye = (cmd.montant_paye_cents || cmd.acompte_cents || 0) / 100;
    const total = (cmd.montant_total_cents || 0) / 100;
    const reste = Math.max(0, total - dejaPaye);

    // 2. Si la commande est soldée (Reste à payer = 0€)
    if (reste <= 0.05 && dejaPaye > 0) {
      return <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded border border-blue-300"><FiCheckCircle /> Totalement Payé</div>;
    }
    
    // 3. Si un paiement a été reçu, même partiel (ex: 50€ d'acompte)
    if (dejaPaye > 0) {
      return <div className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded border border-orange-300"><FiCreditCard /> Réservé</div>;
    }

    // 4. Si 0€ encaissé pour l'instant
    return <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-200 px-2 py-1 rounded border border-slate-300"><FiClock /> En Attente</div>;
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FiList className="text-teal-600" /> Registre Global
          </h2>
          <p className="text-slate-500 text-sm mt-1">Suivi financier strict de toutes les réservations.</p>
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
                  const dejaPaye = (cmd.montant_paye_cents || cmd.acompte_cents || 0) / 100;
                  const total = (cmd.montant_total_cents || 0) / 100;
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
                        {cmd.numero_boucle || cmd.statut === 'bouclee' ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold border border-emerald-200">
                            {cmd.numero_boucle || cmd.ticket_num}
                          </span>
                        ) : (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-xs font-bold border border-slate-200 dark:border-slate-600 border-dashed" title="Sera officiellement validé au bouclage">
                            {cmd.ticket_num}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-black text-slate-800 dark:text-white">
                        {reste > 0.05 ? `${reste.toFixed(2)} €` : <span className="text-emerald-500">Soldé</span>}
                      </td>
                      <td className="p-4 text-center">
                        {renderStatut(cmd)}
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