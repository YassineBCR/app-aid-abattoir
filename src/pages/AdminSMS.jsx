import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiMessageSquare, FiSend, FiUsers, FiFilter, FiAlertCircle, FiLoader, 
  FiCheckCircle, FiList, FiMail, FiCheckSquare, FiSquare, FiTag
} from "react-icons/fi";
import { logAction } from "../lib/logger";

export default function AdminSMS() {
  const { showNotification } = useNotification();
  
  const [commandes, setCommandes] = useState([]);
  const [creneaux, setCreneaux] = useState([]);
  const [joursConfig, setJoursConfig] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtres de ciblage
  const [filterStatut, setFilterStatut] = useState("tous");
  const [filterCreneau, setFilterCreneau] = useState("tous");

  // Options d'envoi (Canaux)
  const [sendSms, setSendSms] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  
  // Contenu du message
  const [emailSubject, setEmailSubject] = useState("");
  const [message, setMessage] = useState("");
  
  // État de l'envoi
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: joursData } = await supabase.from("jours_fete").select("*");
      setJoursConfig(joursData || []);

      const { data: slotsData } = await supabase.from("creneaux_horaires").select("*").order("date").order("heure_debut");
      setCreneaux(slotsData || []);

      const { data: cmdsData } = await supabase
        .from("commandes")
        .select("*, creneaux_horaires(date, heure_debut)")
        .neq("statut", "disponible")
        .neq("statut", "brouillon")
        .neq("statut", "annule")
        .order('ticket_num', { ascending: true });
        
      setCommandes(cmdsData || []);
    } catch (err) {
      showNotification("Erreur lors du chargement des données.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  // 1. Appliquer les filtres sur CHAQUE ticket
  const filteredDestinataires = commandes.filter(cmd => {
    // Filtre par statut
    if (filterStatut === 'paye' && cmd.statut !== 'paye_integralement' && cmd.statut !== 'validee') return false;
    if (filterStatut === 'reserve' && cmd.statut !== 'acompte_paye') return false;
    if (filterStatut === 'boucle' && cmd.statut !== 'bouclee') return false;
    if (filterStatut === 'attente' && cmd.statut !== 'en_attente') return false;
    
    // Filtre par créneau
    if (filterCreneau !== 'tous' && cmd.creneau_id !== filterCreneau) return false;

    // Vérification des moyens de contact disponibles pour ce ticket
    const canSms = sendSms && !!cmd.contact_phone;
    const canEmail = sendEmail && !!cmd.contact_email;

    if (!canSms && !canEmail) return false;

    return true;
  });

  const getJourLabel = (dateStr) => {
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `Jour ${j.numero}` : `Date inconnue`;
  };

  const handleSendMassMessage = async () => {
    if (!sendSms && !sendEmail) return showNotification("Sélectionnez au moins un canal.", "error");
    if (!message.trim()) return showNotification("Veuillez écrire un message.", "error");
    if (sendEmail && !emailSubject.trim()) return showNotification("Veuillez saisir un objet pour l'e-mail.", "error");
    if (filteredDestinataires.length === 0) return showNotification("Aucun ticket ne correspond.", "error");
    
    const confirm = window.confirm(`Envoyer ce message à ${filteredDestinataires.length} tickets ?`);
    if (!confirm) return;

    setSending(true);
    setSendProgress(0);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filteredDestinataires.length; i++) {
        const ticket = filteredDestinataires[i];
        let ok = false;

        // Envoi SMS pour ce ticket
        if (sendSms && ticket.contact_phone) {
            try {
                const res = await fetch("http://localhost:3000/send-sms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: ticket.contact_phone, message: message })
                });
                if (res.ok) ok = true;
            } catch (e) { console.error(e); }
        }

        // Envoi Email pour ce ticket
        if (sendEmail && ticket.contact_email) {
            try {
                const res = await fetch("http://localhost:3000/send-custom-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: ticket.contact_email, subject: emailSubject, message: message })
                });
                if (res.ok) ok = true;
            } catch (e) { console.error(e); }
        }

        if (ok) successCount++; else failCount++;
        setSendProgress(Math.round(((i + 1) / filteredDestinataires.length) * 100));
    }

    logAction('CONTACT', 'MARKETING', { action: 'Envoi masse par ticket', total: filteredDestinataires.length, reussis: successCount });

    setSending(false);
    setMessage("");
    if (sendEmail) setEmailSubject("");
    showNotification(`${successCount} messages envoyés avec succès !`, failCount === 0 ? "success" : "info");
  };

  const renderBadgeStatut = (statut) => {
      if (statut === 'paye_integralement' || statut === 'validee') return <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Payé</span>;
      if (statut === 'acompte_paye') return <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Acompte</span>;
      if (statut === 'bouclee') return <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Bouclé</span>;
      return <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Attente</span>;
  };

  if (loadingData) return <div className="p-20 text-center animate-pulse text-purple-500 font-bold">Chargement des destinataires...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/30"><FiMessageSquare className="text-2xl" /></div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Marketing Multicanal</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Communication groupée par ticket individuel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-700">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 uppercase tracking-wider text-sm"><FiFilter className="text-purple-500" /> Ciblage</h3>
                  <div className="space-y-5">
                      <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-3 rounded-xl font-medium outline-none focus:border-purple-500">
                          <option value="tous">Tous les statuts</option>
                          <option value="reserve">Réservés (Acompte payé)</option>
                          <option value="paye">Totalement Payés</option>
                          <option value="boucle">Bouclés (Prêts)</option>
                          <option value="attente">En attente (Impayés)</option>
                      </select>
                      <select value={filterCreneau} onChange={(e) => setFilterCreneau(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white p-3 rounded-xl font-medium outline-none focus:border-purple-500">
                          <option value="tous">Tous les créneaux</option>
                          {creneaux.map(c => (
                              <option key={c.id} value={c.id}>{getJourLabel(c.date)} - {c.heure_debut.slice(0,5)}</option>
                          ))}
                      </select>
                  </div>
              </div>

              <div className="bg-purple-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                      <FiTag className="text-4xl text-purple-200 mb-3" />
                      <p className="text-sm font-bold text-purple-200 uppercase">Tickets ciblés</p>
                      <h3 className="text-6xl font-black mt-2">{filteredDestinataires.length}</h3>
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col max-h-[30rem]">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 uppercase tracking-wider text-sm shrink-0"><FiList className="text-purple-500" /> Liste des tickets</h3>
                  <div className="overflow-y-auto space-y-2 pr-2 custom-scrollbar flex-1">
                      {filteredDestinataires.length === 0 ? (
                          <p className="text-sm text-slate-400 italic text-center py-6">Aucun destinataire.</p>
                      ) : (
                          filteredDestinataires.map(t => (
                              <div key={t.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                                  <div className="flex justify-between items-start">
                                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                          <span className="text-purple-600 mr-2">#{t.ticket_num}</span> 
                                          {t.contact_last_name}
                                      </p>
                                      {renderBadgeStatut(t.statut)}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                      {sendSms && t.contact_phone && <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1"><FiMessageSquare/> {t.contact_phone}</span>}
                                      {sendEmail && t.contact_email && <span className="text-[9px] text-blue-600 font-bold flex items-center gap-1"><FiMail/> Email OK</span>}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>

          <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700 h-full flex flex-col">
                  <div className="flex gap-4 mb-8">
                      <button onClick={() => setSendSms(!sendSms)} className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-bold border-2 transition-all ${sendSms ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          {sendSms ? <FiCheckSquare/> : <FiSquare/>} SMS
                      </button>
                      <button onClick={() => setSendEmail(!sendEmail)} className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl font-bold border-2 transition-all ${sendEmail ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          {sendEmail ? <FiCheckSquare/> : <FiSquare/>} Email
                      </button>
                  </div>

                  {sendEmail && (
                      <div className="mb-6">
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Objet de l'email</label>
                          <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Sujet..." className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-xl font-medium outline-none focus:border-blue-500 dark:text-white" />
                      </div>
                  )}

                  <div className="flex justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Votre Message</label>
                      {sendSms && <span className="text-xs font-bold text-slate-400">{message.length}/160</span>}
                  </div>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows="10" placeholder="Rédigez votre message ici..." className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-5 rounded-2xl font-medium outline-none focus:border-purple-500 dark:text-white resize-none"></textarea>

                  {sending && (
                      <div className="mt-6 space-y-2">
                          <div className="flex justify-between text-xs font-bold text-purple-600"><span>Progression...</span><span>{sendProgress}%</span></div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all" style={{ width: `${sendProgress}%` }}></div></div>
                      </div>
                  )}

                  <button onClick={handleSendMassMessage} disabled={sending || filteredDestinataires.length === 0 || !message.trim()} className="mt-6 w-full py-5 bg-purple-600 hover:bg-purple-700 text-white font-black text-lg rounded-2xl shadow-xl flex justify-center items-center gap-3 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50">
                      {sending ? <FiLoader className="animate-spin" /> : <FiSend />} ENVOYER À {filteredDestinataires.length} TICKETS
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
}