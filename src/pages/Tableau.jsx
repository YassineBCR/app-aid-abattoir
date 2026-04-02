import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiList, FiSearch, FiDownload, FiCheckCircle, FiClock, FiCreditCard, 
  FiAlertCircle, FiTag, FiUser, FiPhone, FiMail, FiCalendar, FiDollarSign, FiX, FiFileText, FiArrowRight, FiLink,
  FiMessageSquare, FiSend, FiLoader, FiTrash2, FiFilter
} from "react-icons/fi";
import { useNotification } from "../contexts/NotificationContext";
import { logAction } from "../lib/logger"; 

export default function Tableau({ changeTab, userRole }) {
  const { showNotification } = useNotification();
  const [commandes, setCommandes] = useState([]);
  const [joursConfig, setJoursConfig] = useState([]);
  const [creneauxConfig, setCreneauxConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); 
  const [filterDate, setFilterDate] = useState("");
  const [filterCreneauId, setFilterCreneauId] = useState("");
  
  const [limit, setLimit] = useState(50); 
  const [hasMore, setHasMore] = useState(true);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showMailModal, setShowMailModal] = useState(false);
  const [customMailSubject, setCustomMailSubject] = useState("");
  const [customMailBody, setCustomMailBody] = useState("");
  const [sendingCustomMail, setSendingCustomMail] = useState(false);

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [customSmsBody, setCustomSmsBody] = useState("");
  const [sendingCustomSms, setSendingCustomSms] = useState(false);

  useEffect(() => {
    async function loadConfig() {
        const { data: jours } = await supabase.from("jours_fete").select("*");
        setJoursConfig(jours || []);
        const { data: cren } = await supabase.from("creneaux_horaires").select("*").order("date").order("heure_debut");
        setCreneauxConfig(cren || []);
    }
    loadConfig();
  }, []);

  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearch(searchTerm.trim());
          setLimit(50);
      }, 400); 
      return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('table_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [limit, debouncedSearch, filterDate, filterCreneauId]);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut )`, { count: 'exact' })
        .not("contact_last_name", "is", null)
        .neq("contact_last_name", "")
        .neq("statut", "disponible")
        .neq("statut", "brouillon")
        .neq("statut", "en_attente"); // ✅ On exclut les paniers abandonnés

      if (filterCreneauId) {
          query = query.eq('creneau_id', filterCreneauId);
      } else if (filterDate && creneauxConfig.length > 0) {
          const ids = creneauxConfig.filter(c => c.date === filterDate).map(c => c.id);
          if (ids.length > 0) {
              query = query.in('creneau_id', ids);
          } else {
              query = query.eq('creneau_id', '00000000-0000-0000-0000-000000000000');
          }
      }

      if (debouncedSearch) {
          const isNumeric = /^\d+$/.test(debouncedSearch);
          if (isNumeric) {
              query = query.or(`contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`);
          } else {
              query = query.or(`contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%`);
          }
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      setCommandes(data || []);
      setHasMore(count > (data || []).length);
    } catch (err) {
      console.error(err);
      showNotification("Erreur de chargement du registre", "error");
    } finally {
      setLoading(false);
    }
  }

  const getJourLabel = (dateStr) => { 
      if (!dateStr) return "-";
      const j = joursConfig.find(jd => jd.date_fete === dateStr); 
      return j ? `Jour ${j.numero}` : 'Jour Inconnu'; 
  };

  const uniqueDates = [...new Set(creneauxConfig.map(c => c.date))];

  const handleRowClick = async (cmd) => {
    setSelectedOrder(cmd);
    setLoadingHistory(true);
    try {
        const { data, error } = await supabase
            .from('historique_paiements')
            .select('*')
            .eq('commande_id', cmd.id)
            .order('date_paiement', { ascending: false });
            
        if (error) throw error;
        setOrderHistory(data || []);
    } catch (err) {
        console.error(err);
        showNotification("Erreur chargement historique", "error");
    } finally {
        setLoadingHistory(false);
    }
  };

  const handlePrendreEnCharge = () => {
    sessionStorage.setItem('pending_commande_id', selectedOrder.id);
    if (changeTab) changeTab('prise_en_charge');
  };

  const renvoyerBillet = async (cmd) => {
      setSendingMail(true);
      try {
          const dateFormatee = cmd.creneaux_horaires?.date ? new Date(cmd.creneaux_horaires.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : "Date inconnue";
          const heureFormatee = cmd.creneaux_horaires?.heure_debut ? cmd.creneaux_horaires.heure_debut.slice(0,5) : "";
          const qrData = JSON.stringify({ id: cmd.id, ticket: cmd.ticket_num, nom: cmd.contact_last_name });

          const response = await fetch("http://localhost:3000/send-ticket-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  email: cmd.contact_email,
                  firstName: cmd.contact_first_name,
                  ticketNum: cmd.ticket_num,
                  sacrificeName: cmd.sacrifice_name,
                  dateCreneau: dateFormatee,
                  heureCreneau: heureFormatee,
                  qrData: qrData
              })
          });

          if (response.ok) {
              showNotification("Billet renvoyé avec succès !", "success");
              logAction('MODIFICATION', 'COMMANDE', { action: 'Renvoi du billet', ticket: cmd.ticket_num });
          } else {
              throw new Error("Erreur serveur lors de l'envoi");
          }
      } catch (err) {
          console.error(err);
          showNotification("Impossible d'envoyer l'email.", "error");
      } finally {
          setSendingMail(false);
      }
  };

  const handleSendCustomMail = async (e) => {
      e.preventDefault();
      if (!customMailSubject.trim() || !customMailBody.trim()) return showNotification("Veuillez remplir tous les champs.", "error");
      
      setSendingCustomMail(true);
      try {
          const response = await fetch("http://localhost:3000/send-custom-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: selectedOrder.contact_email, subject: customMailSubject, message: customMailBody })
          });

          if (response.ok) {
              showNotification("Email envoyé !", "success");
              logAction('CONTACT', 'COMMANDE', { action: 'Email client', ticket: selectedOrder.ticket_num, sujet: customMailSubject });
              setShowMailModal(false); setCustomMailSubject(""); setCustomMailBody("");
          } else throw new Error("Erreur");
      } catch (err) { showNotification("Erreur d'envoi.", "error"); } 
      finally { setSendingCustomMail(false); }
  };

  const handleSendCustomSms = async (e) => {
      e.preventDefault();
      if (!customSmsBody.trim()) return showNotification("Message vide.", "error");
      
      setSendingCustomSms(true);
      try {
          const response = await fetch("http://localhost:3000/send-sms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: selectedOrder.contact_phone, message: customSmsBody })
          });

          if (response.ok) {
              showNotification("SMS envoyé !", "success");
              logAction('CONTACT', 'COMMANDE', { action: 'SMS client', ticket: selectedOrder.ticket_num });
              setShowSmsModal(false); setCustomSmsBody("");
          } else throw new Error("Erreur");
      } catch (err) { showNotification("Erreur d'envoi SMS.", "error"); } 
      finally { setSendingCustomSms(false); }
  };

  const handleDeleteOrder = async () => {
    if (!window.confirm(`⚠️ Supprimer DÉFINITIVEMENT le dossier #${selectedOrder.ticket_num} ?`)) return;
    setIsDeleting(true);
    try {
        const { error } = await supabase.from('commandes').delete().eq('id', selectedOrder.id);
        if (error) throw error;
        showNotification("Supprimée avec succès", "success");
        logAction('SUPPRESSION', 'COMMANDE', { action: 'Suppression définitive', ticket: selectedOrder.ticket_num });
        setSelectedOrder(null);
    } catch (err) { showNotification("Erreur suppression", "error"); } 
    finally { setIsDeleting(false); }
  };

  const exportToCSV = async () => {
    showNotification("Préparation de l'export...", "info");
    
    let exportQuery = supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut )`)
        .not("contact_last_name", "is", null)
        .neq("contact_last_name", "")
        .neq("statut", "disponible")
        .neq("statut", "brouillon")
        .neq("statut", "en_attente"); // ✅ Même filtre pour l'export

    if (filterCreneauId) {
        exportQuery = exportQuery.eq('creneau_id', filterCreneauId);
    } else if (filterDate && creneauxConfig.length > 0) {
        const ids = creneauxConfig.filter(c => c.date === filterDate).map(c => c.id);
        if (ids.length > 0) exportQuery = exportQuery.in('creneau_id', ids);
    }

    if (debouncedSearch) {
        const isNumeric = /^\d+$/.test(debouncedSearch);
        if (isNumeric) exportQuery = exportQuery.or(`contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`);
        else exportQuery = exportQuery.or(`contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%`);
    }

    const { data: allData, error } = await exportQuery.order("created_at", { ascending: false });

    if (error) {
        showNotification("Erreur lors de l'export", "error");
        return;
    }

    const headers = ["Ticket", "Client", "Téléphone", "Email", "Sacrifice", "Boucle", "Date Retrait", "Acompte", "Payé Total", "Reste à payer", "Statut", "Ref Stripe"];
    const rows = allData.map(c => {
      const dejaPaye = (Number(c.montant_paye_cents) || 0) / 100;
      const total = (Number(c.montant_total_cents) || 0) / 100;
      const reste = Math.max(0, total - dejaPaye);
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
          c.creneaux_horaires ? `${getJourLabel(c.creneaux_horaires.date)} à ${c.creneaux_horaires.heure_debut.slice(0,5)}` : "-",
          `${(c.acompte_cents / 100).toFixed(2)} €`,
          `${dejaPaye.toFixed(2)} €`,
          `${reste.toFixed(2)} €`,
          statutFr,
          c.stripe_ref || ""
      ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Registre_Abattoir.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logAction('EXPORT', 'COMMANDE', { action: `Export du registre (${allData.length} lignes)` });
  };

  const renderStatut = (cmd) => {
    if (cmd.statut === 'annule') return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-lg border border-red-200"><FiAlertCircle /> Annulé</span>;
    if (cmd.statut === 'bouclee') return <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-2.5 py-1 rounded-lg shadow-sm"><FiTag /> Bouclée</span>;
    const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
    const total = (Number(cmd.montant_total_cents) || 0) / 100;
    const reste = Math.max(0, total - dejaPaye);
    if (reste <= 0.05 && dejaPaye > 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200"><FiCheckCircle /> Payé</span>;
    if (dejaPaye > 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200"><FiCreditCard /> Réservé</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"><FiClock /> Attente</span>;
  };

  const getPaymentIcon = (moyen) => {
      switch(moyen) { case 'especes': return <FiDollarSign />; case 'cb': return <FiCreditCard />; case 'stripe': return <FiCreditCard/>; default: return <FiFileText />; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-teal-500 rounded-2xl text-white shadow-lg shadow-teal-500/30"><FiList className="text-2xl" /></div>
            Registre des Commandes
          </h2>
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Seules les réservations confirmées (acompte payé) sont affichées.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          
          <div className="flex w-full md:w-auto items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="pl-3 text-slate-400"><FiFilter /></div>
              
              <select 
                  value={filterDate} 
                  onChange={e => { setFilterDate(e.target.value); setFilterCreneauId(""); setLimit(50); }}
                  className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 py-2 outline-none cursor-pointer"
              >
                  <option value="">Tous les jours</option>
                  {uniqueDates.map(date => (
                      <option key={date} value={date}>{getJourLabel(date)} ({new Date(date).toLocaleDateString('fr-FR')})</option>
                  ))}
              </select>

              <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

              <select 
                  value={filterCreneauId} 
                  onChange={e => { setFilterCreneauId(e.target.value); setLimit(50); }}
                  className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 py-2 pr-3 outline-none cursor-pointer"
                  disabled={!filterDate && creneauxConfig.length === 0}
              >
                  <option value="">Tous les créneaux</option>
                  {creneauxConfig.filter(c => !filterDate || c.date === filterDate).map(c => (
                      <option key={c.id} value={c.id}>
                          {c.heure_debut.slice(0,5)} {filterDate ? '' : `(${getJourLabel(c.date)})`}
                      </option>
                  ))}
              </select>
          </div>

          <div className="relative flex-1 w-full md:w-64 group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors text-lg" />
            <input 
                type="text" 
                placeholder="Nom, ticket, réf..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-2xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium dark:text-white" 
            />
          </div>
          
          <button onClick={exportToCSV} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl transition-colors font-bold shadow-lg shadow-slate-900/20 shrink-0">
            <FiDownload /> Excel
          </button>

        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="p-5">Ticket</th>
                <th className="p-5">Client</th>
                <th className="p-5 hidden sm:table-cell">Contact</th>
                <th className="p-5 hidden md:table-cell">Retrait Prévu</th>
                <th className="p-5">Boucle</th>
                <th className="p-5 text-right">Reste / Payé</th>
                <th className="p-5 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading && commandes.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-400 font-bold animate-pulse">Chargement en cours...</td></tr>
              ) : commandes.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-400">Aucune réservation confirmée pour le moment.</td></tr>
              ) : (
                commandes.map(cmd => {
                  const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
                  const total = (Number(cmd.montant_total_cents) || 0) / 100;
                  const reste = Math.max(0, total - dejaPaye);

                  return (
                    <tr 
                      key={cmd.id} 
                      onClick={() => handleRowClick(cmd)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer group"
                    >
                      <td className="p-5 font-black text-teal-600 dark:text-teal-400 text-base">#{cmd.ticket_num}</td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            {cmd.contact_last_name} {cmd.contact_first_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Pour : <span className="font-medium">{cmd.sacrifice_name}</span></p>
                      </td>
                      <td className="p-5 hidden sm:table-cell">
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{cmd.contact_phone}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[150px]">{cmd.contact_email}</p>
                      </td>
                      <td className="p-5 hidden md:table-cell">
                        <p className="font-bold text-slate-700 dark:text-slate-200">{cmd.creneaux_horaires ? getJourLabel(cmd.creneaux_horaires.date) : "-"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cmd.creneaux_horaires ? cmd.creneaux_horaires.heure_debut.slice(0,5) : ""}</p>
                      </td>
                      <td className="p-5">
                        {cmd.numero_boucle || cmd.statut === 'bouclee' ? (
                          <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-black border border-emerald-200 shadow-sm inline-block">
                            {cmd.numero_boucle || cmd.ticket_num}
                          </span>
                        ) : (
                          <span className="bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 border-dashed inline-block" title="Non scannée">
                            {cmd.ticket_num}
                          </span>
                        )}
                      </td>
                      <td className="p-5 text-right font-black text-slate-800 dark:text-white text-base">
                        {dejaPaye > 0 && reste > 0 && (
                            <div className="text-[10px] text-emerald-600 font-black uppercase mb-1">Payé: {dejaPaye.toFixed(2)}€</div>
                        )}
                        {reste > 0.05 ? <span className="text-slate-800 dark:text-white">{reste.toFixed(2)} €</span> : <span className="text-emerald-500">0.00 €</span>}
                      </td>
                      <td className="p-5 text-center">
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

      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
            <button 
                onClick={() => setLimit(prev => prev + 50)}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-black rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95"
            >
                ⬇️ Charger les résultats suivants
            </button>
        </div>
      )}

      {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-slate-900 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white shrink-0">
                      <div>
                          <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-3xl font-black tracking-tight">Dossier N°{selectedOrder.ticket_num}</h3>
                              {renderStatut(selectedOrder)}
                          </div>
                          <p className="text-slate-400 text-sm font-medium">Créé le {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                          {userRole === 'admin_global' && (
                              <button 
                                  onClick={handleDeleteOrder} 
                                  disabled={isDeleting}
                                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all flex items-center gap-2"
                                  title="Supprimer définitivement"
                              >
                                  {isDeleting ? <FiLoader className="animate-spin text-lg" /> : <FiTrash2 className="text-lg" />}
                                  <span className="hidden sm:inline">Supprimer</span>
                              </button>
                          )}
                          <button onClick={handlePrendreEnCharge} className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 hover:scale-105">
                              Aller en caisse <FiArrowRight />
                          </button>
                          <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><FiX className="text-xl"/></button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                          
                          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiUser/> Client</h4>
                              <div>
                                  <p className="text-lg font-black text-slate-800 dark:text-white mb-1">{selectedOrder.contact_last_name} {selectedOrder.contact_first_name}</p>
                                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 text-sm"><FiPhone className="text-slate-400"/> {selectedOrder.contact_phone}</p>
                                  <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 text-sm mt-1 truncate" title={selectedOrder.contact_email}><FiMail className="text-slate-400 shrink-0"/> {selectedOrder.contact_email || "Non renseigné"}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-4 mt-2 border-t border-slate-100 dark:border-slate-700">
                                  {selectedOrder.contact_email && (
                                      <button onClick={() => setShowMailModal(true)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                          <FiMail className="text-sm" /> Écrire
                                      </button>
                                  )}
                                  {selectedOrder.contact_phone && (
                                      <button onClick={() => setShowSmsModal(true)} className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                          <FiMessageSquare className="text-sm" /> SMS
                                      </button>
                                  )}
                                  {selectedOrder.contact_email && selectedOrder.statut !== 'en_attente' && selectedOrder.statut !== 'annule' && (
                                      <button onClick={() => renvoyerBillet(selectedOrder)} disabled={sendingMail} className="w-full py-2 mt-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                                          {sendingMail ? <FiLoader className="animate-spin text-sm" /> : <FiSend className="text-sm" />} 
                                          {sendingMail ? "Envoi en cours..." : "Renvoyer le Billet"}
                                      </button>
                                  )}
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiTag/> Agneau & Retrait</h4>
                              <div>
                                  <p className="text-sm text-slate-500 mb-1">Pour : <strong className="text-slate-800 dark:text-white">{selectedOrder.sacrifice_name}</strong></p>
                                  <p className="text-sm text-slate-500 mb-2">Boucle : <strong className="text-emerald-600 font-black">{selectedOrder.numero_boucle || "En attente"}</strong></p>
                                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 mt-3">
                                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1"><FiCalendar/> Créneau</p>
                                      {selectedOrder.creneaux_horaires ? (
                                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                              {getJourLabel(selectedOrder.creneaux_horaires.date)} <span className="text-slate-400 mx-1">à</span> {selectedOrder.creneaux_horaires.heure_debut.slice(0,5)}
                                          </p>
                                      ) : (
                                          <p className="text-sm text-slate-400">Non défini</p>
                                      )}
                                  </div>
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiDollarSign/> État Financier</h4>
                              <div className="space-y-2">
                                  <div className="flex justify-between text-sm"><span className="text-slate-500">Prix de vente:</span> <span className="font-bold dark:text-white">{(selectedOrder.montant_total_cents / 100).toFixed(2)} €</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-slate-500">Total Net Encaissé:</span> <span className="font-bold text-emerald-600">{((selectedOrder.montant_paye_cents || selectedOrder.acompte_cents || 0) / 100).toFixed(2)} €</span></div>
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-400 uppercase">Reste</span>
                                      <span className="font-black text-lg text-slate-800 dark:text-white">{Math.max(0, ((selectedOrder.montant_total_cents || 0) - (selectedOrder.montant_paye_cents || selectedOrder.acompte_cents || 0)) / 100).toFixed(2)} €</span>
                                  </div>
                                  {selectedOrder.stripe_ref && (
                                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><FiLink /> Réf. Paiement Stripe</p>
                                          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all select-all">
                                              {selectedOrder.stripe_ref}
                                          </p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700">
                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiClock className="text-indigo-500"/> Historique des paiements de ce ticket</h4>
                          </div>
                          <div className="p-4">
                              {loadingHistory ? (
                                  <p className="text-center text-slate-400 text-sm py-4 animate-pulse">Recherche dans la comptabilité...</p>
                              ) : orderHistory.length === 0 ? (
                                  <p className="text-center text-slate-400 text-sm py-4">Aucune trace de paiement guichet pour ce dossier.</p>
                              ) : (
                                  <div className="space-y-3">
                                      {orderHistory.map(tx => (
                                          <div key={tx.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border ${Number(tx.montant_cents) < 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/10' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                                              <div>
                                                  <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                                      {Number(tx.montant_cents) < 0 ? <FiAlertCircle className="text-red-500"/> : getPaymentIcon(tx.moyen_paiement)}
                                                      <span className="uppercase">{tx.moyen_paiement}</span>
                                                  </p>
                                                  <p className="text-xs text-slate-500 mt-1">Le {new Date(tx.date_paiement).toLocaleString('fr-FR')} par {tx.encaisse_par}</p>
                                                  {tx.notes && <p className="text-xs text-red-600 font-bold mt-1 bg-white dark:bg-slate-900 inline-block px-2 py-1 rounded shadow-sm">Motif: {tx.notes}</p>}
                                              </div>
                                              <div className={`text-right font-black mt-2 sm:mt-0 text-lg ${Number(tx.montant_cents) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{(Number(tx.montant_cents) / 100).toFixed(2)} €</div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showMailModal && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in print:hidden">
              <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <FiMail className="text-blue-500" /> Écrire au client
                      </h3>
                      <button onClick={() => setShowMailModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-2 rounded-full"><FiX /></button>
                  </div>
                  <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-sm text-slate-500">Destinataire :</p>
                      <p className="font-bold text-slate-800 dark:text-white">{selectedOrder.contact_first_name} {selectedOrder.contact_last_name} ({selectedOrder.contact_email})</p>
                  </div>
                  <form onSubmit={handleSendCustomMail} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Sujet de l'e-mail *</label>
                          <input required type="text" value={customMailSubject} onChange={(e) => setCustomMailSubject(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 dark:text-white" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Votre message *</label>
                          <textarea required rows="6" value={customMailBody} onChange={(e) => setCustomMailBody(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 dark:text-white resize-none" ></textarea>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setShowMailModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Annuler</button>
                          <button type="submit" disabled={sendingCustomMail} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 transition-all">
                              {sendingCustomMail ? <FiLoader className="animate-spin" /> : <FiSend />} Envoyer
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showSmsModal && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in print:hidden">
              <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <FiMessageSquare className="text-emerald-500" /> Envoyer un SMS
                      </h3>
                      <button onClick={() => setShowSmsModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-2 rounded-full"><FiX /></button>
                  </div>
                  <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">Numéro du client :</p>
                      <p className="font-bold text-emerald-800 dark:text-emerald-300">{selectedOrder.contact_first_name} {selectedOrder.contact_last_name} ({selectedOrder.contact_phone})</p>
                  </div>
                  <form onSubmit={handleSendCustomSms} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex justify-between">
                              <span>Votre message (SMS) *</span>
                              <span className={`text-xs ${customSmsBody.length > 160 ? 'text-red-500' : 'text-slate-400'}`}>{customSmsBody.length}/160</span>
                          </label>
                          <textarea required rows="4" value={customSmsBody} onChange={(e) => setCustomSmsBody(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 dark:text-white resize-none" ></textarea>
                          {customSmsBody.length > 160 && <p className="text-xs text-red-500 mt-1">Facturé comme 2 SMS par OVH.</p>}
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setShowSmsModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Annuler</button>
                          <button type="submit" disabled={sendingCustomSms || !customSmsBody.trim()} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 transition-all">
                              {sendingCustomSms ? <FiLoader className="animate-spin" /> : <FiSend />} Envoyer
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}