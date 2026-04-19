import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiList, FiSearch, FiDownload, FiCheckCircle, FiClock, FiCreditCard, 
  FiAlertCircle, FiTag, FiUser, FiPhone, FiMail, FiCalendar, FiDollarSign, FiX, FiFileText, FiArrowRight, FiLink,
  FiMessageSquare, FiSend, FiLoader, FiTrash2, FiFilter, FiEdit, FiSave, FiChevronDown, FiSmartphone
} from "react-icons/fi";
import { useNotification } from "../contexts/NotificationContext";
import { logAction } from "../lib/logger"; 
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Constantes de statut ─────────────────────────────────────────────────────
const STATUT_OPTIONS = [
  { value: "",        label: "Tous les statuts", color: "text-slate-500"   },
  { value: "attente", label: "En attente",       color: "text-slate-600"   },
  { value: "reserve", label: "Réservé",          color: "text-orange-600"  },
  { value: "paye",    label: "Payé",             color: "text-blue-600"    },
  { value: "bouclee", label: "Bouclée",          color: "text-emerald-600" },
  { value: "annule",  label: "Annulé",           color: "text-red-600"     },
];

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

export default function Tableau({ changeTab, userRole }) {
  const { showNotification } = useNotification();
  const [commandes, setCommandes]           = useState([]);
  const [joursConfig, setJoursConfig]       = useState([]);
  const [creneauxConfig, setCreneauxConfig] = useState([]);
  const [loading, setLoading]               = useState(true);
  
  const [searchTerm, setSearchTerm]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDate, setFilterDate]           = useState("");
  const [filterCreneauId, setFilterCreneauId] = useState("");
  const [filterStatut, setFilterStatut]       = useState("");

  const [limit, setLimit]     = useState(50);
  const [hasMore, setHasMore] = useState(true);

  const [selectedOrder, setSelectedOrder]     = useState(null);
  const [orderHistory, setOrderHistory]       = useState([]);
  const [loadingHistory, setLoadingHistory]   = useState(false);
  const [sendingMail, setSendingMail]         = useState(false);
  const [isDeleting, setIsDeleting]           = useState(false);

  const [isEditing, setIsEditing]       = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isSaving, setIsSaving]         = useState(false);

  const [showMailModal, setShowMailModal]         = useState(false);
  const [customMailSubject, setCustomMailSubject] = useState("");
  const [customMailBody, setCustomMailBody]       = useState("");
  const [sendingCustomMail, setSendingCustomMail] = useState(false);

  const [showSmsModal, setShowSmsModal]         = useState(false);
  const [customSmsBody, setCustomSmsBody]       = useState("");
  const [sendingCustomSms, setSendingCustomSms] = useState(false);

  // ── Config ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadConfig() {
      const { data: jours } = await supabase.from("jours_fete").select("*");
      setJoursConfig(jours || []);
      const { data: cren } = await supabase.from("creneaux_horaires").select("*").order("date").order("heure_debut");
      setCreneauxConfig(cren || []);
    }
    loadConfig();
  }, []);

  // ── Debounce ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setLimit(50);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // ── Fetch principal ────────────────────────────────────────────────────────
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
        .neq("statut", "en_attente");

      if (filterCreneauId) {
        query = query.eq('creneau_id', filterCreneauId);
      } else if (filterDate && creneauxConfig.length > 0) {
        const ids = creneauxConfig.filter(c => c.date === filterDate).map(c => c.id);
        query = ids.length > 0
          ? query.in('creneau_id', ids)
          : query.eq('creneau_id', '00000000-0000-0000-0000-000000000000');
      }

      if (debouncedSearch) {
        const isNumeric   = /^\d+$/.test(debouncedSearch);
        const isTicketNum = isNumeric && debouncedSearch.length < 8;
        query = isTicketNum
          ? query.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`)
          : query.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%`);
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

  // ── Filtre statut côté client ──────────────────────────────────────────────
  const filteredCommandes = useMemo(() => {
    if (!filterStatut) return commandes;
    return commandes.filter(cmd => getStatutMetier(cmd) === filterStatut);
  }, [commandes, filterStatut]);

  const countsByStatut = useMemo(() => {
    const counts = { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 };
    commandes.forEach(cmd => {
      const s = getStatutMetier(cmd);
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [commandes]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getJourLabel = (dateStr) => {
    if (!dateStr) return "-";
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `Jour ${j.numero}` : "Jour Inconnu";
  };

  const uniqueDates = [...new Set(creneauxConfig.map(c => c.date))];

  // ── Chargement historique depuis comptabilite ──────────────────────────────
  const handleRowClick = async (cmd) => {
    setSelectedOrder(cmd);
    setLoadingHistory(true);
    setIsEditing(false);
    try {
      // ← Lecture depuis la nouvelle table comptabilite
      const { data, error } = await supabase
        .from('comptabilite')
        .select('*')
        .eq('commande_id', cmd.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrderHistory(data || []);
    } catch (err) {
      console.error(err);
      showNotification("Erreur chargement historique", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseModal  = () => { setSelectedOrder(null); setIsEditing(false); };
  const startEditing      = () => {
    setEditFormData({ ...selectedOrder, montant_total_euros: (selectedOrder.montant_total_cents / 100).toFixed(2) });
    setIsEditing(true);
  };
  const cancelEditing = () => { setIsEditing(false); setEditFormData({}); };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const updatedData = {
        contact_last_name:   editFormData.contact_last_name,
        contact_first_name:  editFormData.contact_first_name,
        contact_phone:       editFormData.contact_phone,
        contact_email:       editFormData.contact_email,
        sacrifice_name:      editFormData.sacrifice_name,
        creneau_id:          editFormData.creneau_id || null,
        montant_total_cents: Math.round(parseFloat(editFormData.montant_total_euros || 0) * 100),
      };
      const { data, error } = await supabase
        .from('commandes').update(updatedData).eq('id', selectedOrder.id)
        .select('*, creneaux_horaires(date, heure_debut)').single();
      if (error) throw error;
      showNotification("Modifications enregistrées avec succès", "success");
      logAction('MODIFICATION', 'COMMANDE', { action: 'Modification manuelle du dossier', ticket: selectedOrder.ticket_num });
      setSelectedOrder(data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de la sauvegarde", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrendreEnCharge = () => {
    sessionStorage.setItem('pending_commande_id', selectedOrder.id);
    if (changeTab) changeTab('prise_en_charge');
  };

  const renvoyerBillet = async (cmd) => {
    setSendingMail(true);
    try {
      const dateFormatee  = cmd.creneaux_horaires?.date
        ? new Date(cmd.creneaux_horaires.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : "Date inconnue";
      const heureFormatee = cmd.creneaux_horaires?.heure_debut ? cmd.creneaux_horaires.heure_debut.slice(0, 5) : "";
      const qrData        = JSON.stringify({ id: cmd.id, ticket: cmd.ticket_num, nom: cmd.contact_last_name });
      const response      = await fetch("/api/send-ticket-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email: cmd.contact_email, firstName: cmd.contact_first_name, lastName: cmd.contact_last_name,
          phone: cmd.contact_phone, ticketNum: cmd.ticket_num, sacrificeName: cmd.sacrifice_name,
          dateCreneau: dateFormatee, heureCreneau: heureFormatee, qrData
        }),
      });
      if (response.ok) {
        showNotification("Billet renvoyé avec succès !", "success");
        logAction('MODIFICATION', 'COMMANDE', { action: 'Renvoi du billet', ticket: cmd.ticket_num });
      } else throw new Error("Erreur serveur lors de l'envoi");
    } catch (err) { console.error(err); showNotification("Impossible d'envoyer l'email.", "error"); }
    finally { setSendingMail(false); }
  };

  const envoyerConfirmationSms = async (cmd) => {
    setSendingCustomSms(true);
    try {
      const jourStr  = cmd.creneaux_horaires ? getJourLabel(cmd.creneaux_horaires.date) : "Date inconnue";
      const heureStr = cmd.creneaux_horaires ? cmd.creneaux_horaires.heure_debut.slice(0, 5) : "";
      const messageSms = `Confirmation reservation\n${cmd.sacrifice_name}\nN : ${cmd.ticket_num}\n${jourStr} a ${heureStr}\nRDV a partir du 15/05 pour choisir l'agneau`;
      const response = await fetch("/api/send-sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cmd.contact_phone, message: messageSms }),
      });
      if (response.ok) {
        showNotification("SMS de confirmation envoyé !", "success");
        logAction('CONTACT', 'COMMANDE', { action: 'SMS Confirmation Client', ticket: cmd.ticket_num });
      } else throw new Error("Erreur serveur");
    } catch (err) { console.error(err); showNotification("Erreur d'envoi SMS de confirmation.", "error"); }
    finally { setSendingCustomSms(false); }
  };

  const handleSendCustomMail = async (e) => {
    e.preventDefault();
    if (!customMailSubject.trim() || !customMailBody.trim()) return showNotification("Veuillez remplir tous les champs.", "error");
    setSendingCustomMail(true);
    try {
      const response = await fetch("/api/send-custom-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:     selectedOrder.contact_email,
          subject:   customMailSubject,
          message:   customMailBody,
          firstName: selectedOrder.contact_first_name,
          lastName:  selectedOrder.contact_last_name
        }),
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
      const response = await fetch("/api/send-sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedOrder.contact_phone, message: customSmsBody }),
      });
      if (response.ok) {
        showNotification("SMS envoyé !", "success");
        logAction('CONTACT', 'COMMANDE', { action: 'SMS client libre', ticket: selectedOrder.ticket_num });
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

  // ── Export Excel ───────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    showNotification("Préparation de l'export Excel...", "info");
    let exportQuery = supabase.from("commandes")
      .select(`*, creneaux_horaires ( date, heure_debut )`)
      .not("contact_last_name", "is", null)
      .neq("contact_last_name", "")
      .neq("statut", "disponible")
      .neq("statut", "brouillon")
      .neq("statut", "en_attente");

    if (filterCreneauId) {
      exportQuery = exportQuery.eq('creneau_id', filterCreneauId);
    } else if (filterDate && creneauxConfig.length > 0) {
      const ids = creneauxConfig.filter(c => c.date === filterDate).map(c => c.id);
      if (ids.length > 0) exportQuery = exportQuery.in('creneau_id', ids);
    }
    if (debouncedSearch) {
      const isNumeric   = /^\d+$/.test(debouncedSearch);
      const isTicketNum = isNumeric && debouncedSearch.length < 8;
      exportQuery = isTicketNum
        ? exportQuery.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`)
        : exportQuery.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%`);
    }

    const { data: allData, error } = await exportQuery.order("created_at", { ascending: false });
    if (error) { showNotification("Erreur lors de l'export", "error"); return; }

    const exportData = filterStatut
      ? allData.filter(cmd => getStatutMetier(cmd) === filterStatut)
      : allData;

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registre Abattoir');
    worksheet.columns = [
      { header: 'Ticket',        key: 'ticket',   width: 12 },
      { header: 'Client',        key: 'client',   width: 25 },
      { header: 'Téléphone',     key: 'phone',    width: 15 },
      { header: 'Email',         key: 'email',    width: 30 },
      { header: 'Sacrifice',     key: 'sacrifice',width: 20 },
      { header: 'Boucle',        key: 'boucle',   width: 15 },
      { header: 'Date Retrait',  key: 'retrait',  width: 25 },
      { header: 'Acompte',       key: 'acompte',  width: 12 },
      { header: 'Payé Total',    key: 'paye',     width: 12 },
      { header: 'Reste à payer', key: 'reste',    width: 15 },
      { header: 'Statut',        key: 'statut',   width: 20 },
      { header: 'Ref Stripe',    key: 'stripe',   width: 35 },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    exportData.forEach(c => {
      const dejaPaye = (Number(c.montant_paye_cents) || 0) / 100;
      const total    = (Number(c.montant_total_cents) || 0) / 100;
      const reste    = Math.max(0, total - dejaPaye);
      let statutFr = "En Attente", rowColorArgb = null;
      if (c.statut === 'annule')                      { statutFr = 'Annulé';          rowColorArgb = 'FFFEE2E2'; }
      else if (c.statut === 'bouclee')                { statutFr = 'Bouclée';         rowColorArgb = 'FFDBEAFE'; }
      else if (reste <= 0.05 && dejaPaye > 0)         { statutFr = 'Totalement Payé'; rowColorArgb = 'FFD1FAE5'; }
      else if (dejaPaye > 0)                          { statutFr = 'Réservé';         rowColorArgb = 'FFFFEDD5'; }
      const row = worksheet.addRow({
        ticket:   c.ticket_num,
        client:   `${c.contact_last_name} ${c.contact_first_name}`,
        phone:    c.contact_phone,
        email:    c.contact_email,
        sacrifice: c.sacrifice_name,
        boucle:   c.numero_boucle || c.ticket_num,
        retrait:  c.creneaux_horaires ? `${getJourLabel(c.creneaux_horaires.date)} à ${c.creneaux_horaires.heure_debut.slice(0, 5)}` : "-",
        acompte:  `${(c.acompte_cents / 100).toFixed(2)} €`,
        paye:     `${dejaPaye.toFixed(2)} €`,
        reste:    `${reste.toFixed(2)} €`,
        statut:   statutFr,
        stripe:   c.stripe_ref || "",
      });
      if (rowColorArgb) {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColorArgb } };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), "Registre_Abattoir.xlsx");
    logAction('EXPORT', 'COMMANDE', { action: `Export Excel du registre (${exportData.length} lignes)` });
  };

  // ── Rendus ─────────────────────────────────────────────────────────────────
  const renderStatut = (cmd) => {
    if (cmd.statut === 'annule')  return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-lg border border-red-200"><FiAlertCircle /> Annulé</span>;
    if (cmd.statut === 'bouclee') return <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-2.5 py-1 rounded-lg shadow-sm"><FiTag /> Bouclée</span>;
    const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
    const total    = (Number(cmd.montant_total_cents) || 0) / 100;
    const reste    = Math.max(0, total - dejaPaye);
    if (reste <= 0.05 && dejaPaye > 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200"><FiCheckCircle /> Payé</span>;
    if (dejaPaye > 0)                  return <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200"><FiCreditCard /> Réservé</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"><FiClock /> Attente</span>;
  };

  // ← Mise à jour pour les nouveaux moyens de paiement
  const getPaymentIcon = (moyen) => {
    switch (moyen) {
      case 'especes':         return <FiDollarSign />;
      case 'cb':              return <FiCreditCard />;
      case 'stripe_web':      return <FiFileText />;
      case 'stripe_guichet':  return <FiSmartphone />;
      default:                return <FiFileText />;
    }
  };

  const getMoyenLabel = (moyen) => {
    switch (moyen) {
      case 'especes':         return 'Espèces';
      case 'cb':              return 'CB';
      case 'stripe_web':      return 'Stripe Web';
      case 'stripe_guichet':  return 'Stripe Guichet';
      default:                return moyen || 'Inconnu';
    }
  };

  const getRowClassName = (cmd, dejaPaye, reste) => {
    const base = "transition-all cursor-pointer group ";
    if (cmd.statut === 'annule')       return base + "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40";
    if (cmd.statut === 'bouclee')      return base + "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40";
    if (reste <= 0.05 && dejaPaye > 0) return base + "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40";
    if (dejaPaye > 0)                  return base + "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40";
    return base + "hover:bg-slate-50 dark:hover:bg-slate-700/30";
  };

  const hasActiveFilters = filterDate || filterCreneauId || filterStatut || debouncedSearch;
  const resetFilters = () => {
    setFilterDate(""); setFilterCreneauId(""); setFilterStatut(""); setSearchTerm(""); setLimit(50);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in">

      {/* ── En-tête ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-teal-500 rounded-2xl text-white shadow-lg shadow-teal-500/30"><FiList className="text-2xl" /></div>
            Registre des Commandes
          </h2>
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Seules les réservations confirmées (acompte payé) sont affichées.</p>
        </div>
        <button onClick={exportToExcel} className="shrink-0 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl transition-colors font-bold shadow-lg shadow-slate-900/20">
          <FiDownload /> Excel
        </button>
      </div>

      {/* ── Barre de filtres ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm shrink-0">
            <FiFilter /> Filtres
          </div>

          <div className="relative">
            <select value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterCreneauId(""); setLimit(50); }} className="appearance-none pl-3 pr-8 py-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border-2 border-transparent focus:border-teal-500 outline-none cursor-pointer transition-all">
              <option value="">📅 Tous les jours</option>
              {uniqueDates.map(date => (
                <option key={date} value={date}>{getJourLabel(date)} — {new Date(date).toLocaleDateString('fr-FR')}</option>
              ))}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          </div>

          <div className="relative">
            <select value={filterCreneauId} onChange={e => { setFilterCreneauId(e.target.value); setLimit(50); }} className="appearance-none pl-3 pr-8 py-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border-2 border-transparent focus:border-teal-500 outline-none cursor-pointer transition-all">
              <option value="">🕐 Tous les créneaux</option>
              {creneauxConfig.filter(c => !filterDate || c.date === filterDate).map(c => (
                <option key={c.id} value={c.id}>
                  {c.heure_debut.slice(0, 5)}{filterDate ? '' : ` (${getJourLabel(c.date)})`}
                </option>
              ))}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          </div>

          <div className="relative">
            <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setLimit(50); }} className="appearance-none pl-3 pr-8 py-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border-2 border-transparent focus:border-teal-500 outline-none cursor-pointer transition-all">
              {STATUT_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          </div>

          <div className="relative flex-1 min-w-[200px] group">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
            <input type="text" placeholder="Nom, email, tél, #ticket..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium" />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"><FiX /></button>
            )}
          </div>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl border border-red-200 dark:border-red-800 transition-colors">
              <FiX className="text-sm" /> Réinitialiser
            </button>
          )}
        </div>

        {/* Compteurs statuts */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
          {[
            { key: "attente", label: "Attente",  bg: "bg-slate-100 dark:bg-slate-700",         text: "text-slate-700 dark:text-slate-300",    border: "border-slate-300 dark:border-slate-600"    },
            { key: "reserve", label: "Réservé",  bg: "bg-orange-50 dark:bg-orange-900/20",      text: "text-orange-700 dark:text-orange-300",  border: "border-orange-200 dark:border-orange-800"  },
            { key: "paye",    label: "Payé",     bg: "bg-blue-50 dark:bg-blue-900/20",          text: "text-blue-700 dark:text-blue-300",      border: "border-blue-200 dark:border-blue-800"      },
            { key: "bouclee", label: "Bouclée",  bg: "bg-emerald-50 dark:bg-emerald-900/20",    text: "text-emerald-700 dark:text-emerald-300",border: "border-emerald-200 dark:border-emerald-800"},
            { key: "annule",  label: "Annulé",   bg: "bg-red-50 dark:bg-red-900/20",            text: "text-red-700 dark:text-red-300",        border: "border-red-200 dark:border-red-800"        },
          ].map(({ key, label, bg, text, border }) => (
            <button key={key} onClick={() => setFilterStatut(filterStatut === key ? "" : key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${bg} ${text} ${border} ${filterStatut === key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-70 hover:opacity-100'}`}
            >
              <span>{countsByStatut[key]}</span>
              <span>{label}</span>
            </button>
          ))}
          <span className="text-xs text-slate-400 font-medium self-center ml-auto">
            {filteredCommandes.length} résultat{filteredCommandes.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Tableau principal ── */}
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
              ) : filteredCommandes.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-400">Aucune réservation pour ces critères.</td></tr>
              ) : (
                filteredCommandes.map(cmd => {
                  const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
                  const total    = (Number(cmd.montant_total_cents) || 0) / 100;
                  const reste    = Math.max(0, total - dejaPaye);
                  return (
                    <tr key={cmd.id} onClick={() => handleRowClick(cmd)} className={getRowClassName(cmd, dejaPaye, reste)}>
                      <td className="p-5 font-black text-teal-600 dark:text-teal-400 text-base">#{cmd.ticket_num}</td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800 dark:text-white">{cmd.contact_last_name} {cmd.contact_first_name}</p>
                        <p className="text-xs text-slate-500 mt-1">Pour : <span className="font-medium">{cmd.sacrifice_name}</span></p>
                      </td>
                      <td className="p-5 hidden sm:table-cell">
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{cmd.contact_phone}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[150px]">{cmd.contact_email}</p>
                      </td>
                      <td className="p-5 hidden md:table-cell">
                        <p className="font-bold text-slate-700 dark:text-slate-200">{cmd.creneaux_horaires ? getJourLabel(cmd.creneaux_horaires.date) : "-"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cmd.creneaux_horaires ? cmd.creneaux_horaires.heure_debut.slice(0, 5) : ""}</p>
                      </td>
                      <td className="p-5">
                        {cmd.numero_boucle || cmd.statut === 'bouclee' ? (
                          <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-black border border-emerald-200 shadow-sm inline-block">
                            {cmd.numero_boucle || cmd.ticket_num}
                          </span>
                        ) : (
                          <span className="bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 border-dashed inline-block">
                            {cmd.ticket_num}
                          </span>
                        )}
                      </td>
                      <td className="p-5 text-right font-black text-slate-800 dark:text-white text-base">
                        {dejaPaye > 0 && reste > 0 && (
                          <div className="text-[10px] text-emerald-600 font-black uppercase mb-1">Payé: {dejaPaye.toFixed(2)}€</div>
                        )}
                        {reste > 0.05
                          ? <span className="text-slate-800 dark:text-white">{reste.toFixed(2)} €</span>
                          : <span className="text-emerald-500">0.00 €</span>}
                      </td>
                      <td className="p-5 text-center">{renderStatut(cmd)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
          <button onClick={() => setLimit(prev => prev + 50)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-black rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
            ⬇️ Charger les résultats suivants
          </button>
        </div>
      )}

      {/* ═══════════ MODALE DÉTAIL COMMANDE ═══════════ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="bg-slate-900 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-3xl font-black tracking-tight">Dossier N°{selectedOrder.ticket_num}</h3>
                  {renderStatut(selectedOrder)}
                </div>
                <p className="text-slate-400 text-sm font-medium">Créé le {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="flex items-center flex-wrap gap-3">
                {!isEditing ? (
                  <button onClick={startEditing} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2">
                    <FiEdit className="text-lg" /><span className="hidden sm:inline">Modifier</span>
                  </button>
                ) : (
                  <>
                    <button onClick={cancelEditing} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all">Annuler</button>
                    <button onClick={handleSaveEdit} disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2">
                      {isSaving ? <FiLoader className="animate-spin text-lg" /> : <FiSave className="text-lg" />}
                      <span className="hidden sm:inline">Enregistrer</span>
                    </button>
                  </>
                )}
                {userRole === 'admin_global' && !isEditing && (
                  <button onClick={handleDeleteOrder} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all flex items-center gap-2">
                    {isDeleting ? <FiLoader className="animate-spin text-lg" /> : <FiTrash2 className="text-lg" />}
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                )}
                {!isEditing && (
                  <button onClick={handlePrendreEnCharge} className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 hover:scale-105">
                    Aller en caisse <FiArrowRight />
                  </button>
                )}
                <button onClick={handleCloseModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><FiX className="text-xl" /></button>
              </div>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">

                {/* Bloc Client */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiUser /> Client</h4>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Nom & Prénom</label>
                        <div className="flex gap-2">
                          <input type="text" value={editFormData.contact_last_name} onChange={e => setEditFormData({ ...editFormData, contact_last_name: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" placeholder="Nom" />
                          <input type="text" value={editFormData.contact_first_name} onChange={e => setEditFormData({ ...editFormData, contact_first_name: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" placeholder="Prénom" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Téléphone</label>
                        <input type="text" value={editFormData.contact_phone} onChange={e => setEditFormData({ ...editFormData, contact_phone: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Email</label>
                        <input type="email" value={editFormData.contact_email} onChange={e => setEditFormData({ ...editFormData, contact_email: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-black text-slate-800 dark:text-white mb-1">{selectedOrder.contact_last_name} {selectedOrder.contact_first_name}</p>
                      <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 text-sm"><FiPhone className="text-slate-400" /> {selectedOrder.contact_phone}</p>
                      <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 text-sm mt-1 truncate" title={selectedOrder.contact_email}><FiMail className="text-slate-400 shrink-0" /> {selectedOrder.contact_email || "Non renseigné"}</p>
                    </div>
                  )}
                  {!isEditing && (
                    <div className="flex flex-wrap gap-2 pt-4 mt-2 border-t border-slate-100 dark:border-slate-700">
                      {selectedOrder.contact_email && (
                        <button onClick={() => setShowMailModal(true)} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                          <FiMail className="text-sm" /> Écrire
                        </button>
                      )}
                      {selectedOrder.contact_phone && (
                        <button onClick={() => setShowSmsModal(true)} className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                          <FiMessageSquare className="text-sm" /> SMS Libre
                        </button>
                      )}
                      {selectedOrder.contact_phone && selectedOrder.statut !== 'en_attente' && selectedOrder.statut !== 'annule' && (
                        <button onClick={() => envoyerConfirmationSms(selectedOrder)} disabled={sendingCustomSms} className="w-full py-2 mt-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                          {sendingCustomSms ? <FiLoader className="animate-spin text-sm" /> : <FiMessageSquare className="text-sm" />}
                          {sendingCustomSms ? "Envoi en cours..." : "SMS de Confirmation"}
                        </button>
                      )}
                      {selectedOrder.contact_email && selectedOrder.statut !== 'en_attente' && selectedOrder.statut !== 'annule' && (
                        <button onClick={() => renvoyerBillet(selectedOrder)} disabled={sendingMail} className="w-full py-2 mt-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                          {sendingMail ? <FiLoader className="animate-spin text-sm" /> : <FiSend className="text-sm" />}
                          {sendingMail ? "Envoi en cours..." : "Renvoyer le Billet"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bloc Agneau & Retrait */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiTag /> Agneau & Retrait</h4>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Nom pour le sacrifice</label>
                        <input type="text" value={editFormData.sacrifice_name} onChange={e => setEditFormData({ ...editFormData, sacrifice_name: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" />
                      </div>
                      <p className="text-sm text-slate-500">Boucle : <strong className="text-emerald-600 font-black">{selectedOrder.numero_boucle || "En attente"}</strong></p>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Créneau de retrait</label>
                        <select value={editFormData.creneau_id || ""} onChange={e => setEditFormData({ ...editFormData, creneau_id: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500">
                          <option value="">-- Sans créneau --</option>
                          {creneauxConfig.map(c => (
                            <option key={c.id} value={c.id}>{getJourLabel(c.date)} à {c.heure_debut.slice(0, 5)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Pour : <strong className="text-slate-800 dark:text-white">{selectedOrder.sacrifice_name}</strong></p>
                      <p className="text-sm text-slate-500 mb-2">Boucle : <strong className="text-emerald-600 font-black">{selectedOrder.numero_boucle || "En attente"}</strong></p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 mt-3">
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1"><FiCalendar /> Créneau</p>
                        {selectedOrder.creneaux_horaires ? (
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {getJourLabel(selectedOrder.creneaux_horaires.date)} <span className="text-slate-400 mx-1">à</span> {selectedOrder.creneaux_horaires.heure_debut.slice(0, 5)}
                          </p>
                        ) : <p className="text-sm text-slate-400">Non défini</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloc Finances */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2"><FiDollarSign /> État Financier</h4>
                  {isEditing ? (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Prix de vente total (€)</label>
                      <input type="number" step="0.01" value={editFormData.montant_total_euros} onChange={e => setEditFormData({ ...editFormData, montant_total_euros: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" />
                      <p className="text-[10px] text-amber-600 mt-1.5 font-medium leading-tight">Attention: Changer ce prix recalculera le "Reste à payer".</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Prix de vente:</span><span className="font-bold dark:text-white">{(selectedOrder.montant_total_cents / 100).toFixed(2)} €</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Total Encaissé:</span><span className="font-bold text-emerald-600">{((selectedOrder.montant_paye_cents || selectedOrder.acompte_cents || 0) / 100).toFixed(2)} €</span></div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Reste</span>
                        <span className="font-black text-lg text-slate-800 dark:text-white">{Math.max(0, ((selectedOrder.montant_total_cents || 0) - (selectedOrder.montant_paye_cents || selectedOrder.acompte_cents || 0)) / 100).toFixed(2)} €</span>
                      </div>
                      {selectedOrder.stripe_ref && (
                        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><FiLink /> Réf. Paiement Stripe</p>
                          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all select-all">{selectedOrder.stripe_ref}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Historique paiements (depuis comptabilite) ── */}
              {!isEditing && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiClock className="text-indigo-500" /> Historique des paiements
                      <span className="text-xs text-slate-400 font-medium ml-1">(table <code className="font-mono">comptabilite</code>)</span>
                    </h4>
                  </div>
                  <div className="p-4">
                    {loadingHistory ? (
                      <p className="text-center text-slate-400 text-sm py-4 animate-pulse">Chargement de la comptabilité...</p>
                    ) : orderHistory.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-4">Aucune trace de paiement pour ce dossier.</p>
                    ) : (
                      <div className="space-y-3">
                        {orderHistory.map(tx => (
                          <div key={tx.id} className={`flex flex-col sm:flex-row sm:items-start justify-between p-3 rounded-xl border gap-3 ${Number(tx.montant_cents) < 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                          <div className="flex-1">
                            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                              {getPaymentIcon(tx.moyen_paiement)}
                              <span className="uppercase">{getMoyenLabel(tx.moyen_paiement)}</span>
                              {tx.type_mouvement === 'fond_caisse' && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black">FOND</span>}
                            </p>
                            {/* ← created_at remplace date_paiement */}
                            <p className="text-xs text-slate-500 mt-1">
                              Le {new Date(tx.created_at).toLocaleString('fr-FR')}
                            </p>
                            {/* ← operateur_email remplace encaisse_par */}
                            <p className="text-xs text-slate-400 mt-0.5">
                              par <strong className="text-slate-600 dark:text-slate-300">{tx.operateur_email}</strong>
                            </p>
                            {/* ← nouveau : affichage du motif d'annulation */}
                            {tx.motif && (
                              <p className="text-xs text-red-600 font-bold bg-red-50 dark:bg-red-900/20 inline-block px-2 py-1 rounded mt-1.5">
                                Motif: {tx.motif}
                              </p>
                            )}
                            {tx.notes && !tx.motif && (
                              <p className="text-[11px] text-slate-400 italic mt-1">{tx.notes}</p>
                            )}
                            {tx.reference_externe && (
                              <p className="text-[10px] text-indigo-400 font-mono mt-1 truncate max-w-[200px]" title={tx.reference_externe}>
                                Ref: {tx.reference_externe}
                              </p>
                            )}
                          </div>
                          <div className={`text-right font-black text-lg mt-2 sm:mt-0 shrink-0 ${Number(tx.montant_cents) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Number(tx.montant_cents) >= 0 ? '+' : ''}{(Number(tx.montant_cents) / 100).toFixed(2)} €
                          </div>
                        </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Email libre ── */}
      {showMailModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><FiMail className="text-blue-500" /> Écrire au client</h3>
              <button onClick={() => setShowMailModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-2 rounded-full"><FiX /></button>
            </div>
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">Destinataire :</p>
              <p className="font-bold text-slate-800 dark:text-white">{selectedOrder.contact_first_name} {selectedOrder.contact_last_name} ({selectedOrder.contact_email})</p>
            </div>
            <form onSubmit={handleSendCustomMail} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Sujet *</label>
                <input required type="text" value={customMailSubject} onChange={e => setCustomMailSubject(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Message *</label>
                <textarea required rows="6" value={customMailBody} onChange={e => setCustomMailBody(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 dark:text-white resize-none"></textarea>
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

      {/* ── Modale SMS libre ── */}
      {showSmsModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><FiMessageSquare className="text-emerald-500" /> Envoyer un SMS</h3>
              <button onClick={() => setShowSmsModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-2 rounded-full"><FiX /></button>
            </div>
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Numéro du client :</p>
              <p className="font-bold text-emerald-800 dark:text-emerald-300">{selectedOrder.contact_first_name} {selectedOrder.contact_last_name} ({selectedOrder.contact_phone})</p>
            </div>
            <form onSubmit={handleSendCustomSms} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex justify-between">
                  <span>Message (SMS) *</span>
                  <span className={`text-xs ${customSmsBody.length > 160 ? 'text-red-500' : 'text-slate-400'}`}>{customSmsBody.length}/160</span>
                </label>
                <textarea required rows="4" value={customSmsBody} onChange={e => setCustomSmsBody(e.target.value)} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 dark:text-white resize-none"></textarea>
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