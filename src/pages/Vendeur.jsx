import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiCheck, FiX, FiSearch, FiCalendar, FiUser, FiClock, FiAlertCircle } from "react-icons/fi";
import { logAction } from "../lib/logger";

export default function Vendeur() {
  const { showNotification } = useNotification();
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
        .in("statut", ["acompte_paye", "attente_paiement"]) 
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInbox(data || []);
    } catch (error) {
      console.error("Erreur chargement inbox:", error);
      showNotification("Erreur de chargement des commandes.", "error");
    } finally {
      setLoadingInbox(false);
    }
  }

  async function validerCommande(id) {
    if (!window.confirm("Confirmer la validation de cette commande ? Elle passera en attente du solde.")) return;
    try {
      const { error } = await supabase.from("commandes").update({ statut: "validee" }).eq("id", id);
      if (error) throw error;
      showNotification("Commande validée ! Envoyée en caisse.", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de la validation.", "error");
    }
  }

  async function refuserCommande(id) {
    const raison = window.prompt("Motif du refus (ex: Doublon, Erreur...) ?");
    if (raison === null) return; 
    try {
      const { error } = await supabase.from("commandes").update({ statut: "annulee", notes_internes: `Annulée le ${new Date().toLocaleDateString()} : ${raison}` }).eq("id", id);
      if (error) throw error;
      showNotification("Commande annulée.", "info");
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de l'annulation.", "error");
    }
  }

  const filteredInbox = inbox.filter((cmd) => {
    const search = searchTerm.toLowerCase();
    const name = (cmd.contact_last_name + " " + cmd.contact_first_name).toLowerCase();
    const ticket = (cmd.ticket_num || "").toString();
    const email = (cmd.contact_email || "").toLowerCase();
    return name.includes(search) || ticket.includes(search) || email.includes(search);
  });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FiAlertCircle className="text-orange-500" />
            Commandes à Valider
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Vérifiez les acomptes et validez pour envoyer en caisse.
          </p>
        </div>
        
        <div className="relative w-full md:w-64">
          <input
            id="vendeur-search" // <--- ID AJOUTÉ POUR DÉMO
            type="text"
            placeholder="Rechercher (Nom, Ticket...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors dark:text-white"
          />
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {loadingInbox ? (
        <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredInbox.length === 0 ? (
        <div id="vendeur-list" className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheck className="text-3xl text-slate-400" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucune nouvelle commande à traiter.</p>
        </div>
      ) : (
        <div id="vendeur-list" className="grid grid-cols-1 gap-4"> 
          {/* ID AJOUTÉ POUR DÉMO (List wrapper) */}
          {filteredInbox.map((cmd, index) => (
            <div 
              key={cmd.id} 
              className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow flex flex-col lg:flex-row gap-6"
            >
              <div className="flex flex-col items-center justify-center min-w-[100px] border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-700 pb-4 lg:pb-0 pr-0 lg:pr-6">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket</span>
                <span className="text-3xl font-black text-indigo-600 font-mono">#{cmd.ticket_num || "?"}</span>
                <div className={`mt-2 px-2 py-1 rounded text-xs font-bold uppercase ${cmd.statut === 'attente_paiement' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {cmd.statut === 'attente_paiement' ? 'Manuel' : 'Acompte OK'}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                            <FiUser className="text-slate-400" /> {cmd.contact_last_name} {cmd.contact_first_name}
                        </h3>
                        <p className="text-slate-500 text-sm ml-6">{cmd.contact_email} • {cmd.contact_phone}</p>
                    </div>
                </div>
                {/* ... Details omitted for brevity but remain same ... */}
                <div className="text-xs text-slate-500 pt-1">
                    Total: {(cmd.montant_total_cents/100).toFixed(2)}€ • Acompte: {((cmd.acompte_cents||0)/100).toFixed(2)}€
                </div>
              </div>

              <div className="flex flex-row lg:flex-col justify-center gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700 pt-4 lg:pt-0 pl-0 lg:pl-6">
                <button
                  id={index === 0 ? "vendeur-validate-btn" : undefined} // <--- ID AJOUTÉ SEULEMENT AU PREMIER ÉLÉMENT
                  onClick={() => validerCommande(cmd.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95"
                  title="Valider et envoyer en caisse"
                >
                  <FiCheck className="text-xl" />
                  <span className="lg:hidden">Valider</span>
                </button>
                
                <button
                  onClick={() => refuserCommande(cmd.id)}
                  className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 px-3 py-3 rounded-xl transition-all"
                  title="Annuler la commande"
                >
                  <FiX className="text-xl" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}