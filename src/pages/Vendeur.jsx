import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { FiSearch, FiUser, FiCheckCircle, FiCreditCard, FiPackage } from "react-icons/fi";

export default function Vendeur() {
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [inbox, setInbox] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchInbox();
    const subscription = supabase
      .channel('public:commandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => { fetchInbox(); })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  async function fetchInbox() {
    setLoadingInbox(true);
    try {
      const { data, error } = await supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut, heure_fin )`)
        // On affiche toutes les commandes qui ont passé l'étape du paiement Stripe
        .in("statut", ["acompte_paye", "en_attente_caisse", "paye_integralement"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInbox(data || []);
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoadingInbox(false);
    }
  }

  const filteredInbox = inbox.filter((cmd) => {
    const search = searchTerm.toLowerCase();
    const name = (cmd.contact_last_name + " " + cmd.contact_first_name + " " + cmd.sacrifice_name).toLowerCase();
    const ticket = (cmd.ticket_num || "").toString();
    return name.includes(search) || ticket.includes(search);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FiPackage className="text-teal-500" />
            Historique des Commandes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Flux en direct de toutes les réservations validées par un paiement Stripe.
          </p>
        </div>
        
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Rechercher (Nom, Ticket...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-colors dark:text-white"
          />
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {loadingInbox ? (
        <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredInbox.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucune commande confirmée pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4"> 
          {filteredInbox.map((cmd) => (
            <div key={cmd.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-center hover:shadow-md transition-shadow">
              
              {/* Badge Ticket */}
              <div className="flex flex-col items-center justify-center min-w-[120px] bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket</span>
                <span className="text-3xl font-black text-teal-600 font-mono">#{cmd.ticket_num || "?"}</span>
              </div>

              {/* Infos Client */}
              <div className="flex-1 space-y-2 text-center md:text-left">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center justify-center md:justify-start gap-2">
                    <FiUser className="text-slate-400" /> {cmd.contact_last_name} {cmd.contact_first_name}
                </h3>
                <p className="text-slate-500 text-sm">Sacrifice : <span className="font-bold">{cmd.sacrifice_name}</span> | Tél : {cmd.contact_phone}</p>
                
                <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        <FiCheckCircle className="text-teal-500" /> 
                        Payé le {new Date(cmd.created_at).toLocaleDateString('fr-FR')} à {new Date(cmd.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                </div>
              </div>

              {/* Badge Statut */}
              <div className="flex flex-col items-center md:items-end justify-center min-w-[200px] space-y-2">
                <div className={`px-3 py-1.5 rounded-xl border font-bold text-sm flex items-center gap-2
                    ${cmd.statut === 'paye_integralement' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      cmd.statut === 'en_attente_caisse' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-teal-50 text-teal-700 border-teal-200'}`}
                >
                  {cmd.statut === 'paye_integralement' ? "Caisse Clôturée" : cmd.statut === 'en_attente_caisse' ? "Mouton attribué" : "Acompte Payé"}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 font-mono px-2 py-1 rounded">
                  <FiCreditCard /> Stripe : {(cmd.acompte_cents / 100).toFixed(2)} €
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}