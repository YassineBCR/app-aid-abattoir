import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { 
  FiList, FiSearch, FiDownload, FiCheckCircle, FiClock, FiCreditCard, 
  FiAlertCircle, FiTag, FiUser, FiPhone, FiMail, FiCalendar, FiDollarSign, FiX, FiFileText, FiArrowRight, FiLink,
  FiMessageSquare, FiSend, FiLoader, FiTrash2, FiFilter, FiEdit, FiSave, FiChevronDown, FiSmartphone,
  FiArrowUp, FiArrowDown, FiGlobe, FiSliders, FiEdit3
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

// ─── Sources de paiement ─────────────────────────────────────────────────────
const PAYMENT_SOURCES = [
  { value: "",               label: "Toutes les sources", icon: null,           color: "text-slate-500",  bg: "bg-slate-100",   border: "border-slate-200"   },
  { value: "stripe_web",     label: "Stripe Web",         icon: FiGlobe,        color: "text-indigo-600", bg: "bg-indigo-50",   border: "border-indigo-200"  },
  { value: "stripe_guichet", label: "Stripe Guichet",     icon: FiSmartphone,   color: "text-purple-600", bg: "bg-purple-50",   border: "border-purple-200"  },
  { value: "cb",             label: "Carte Bancaire",     icon: FiCreditCard,   color: "text-blue-600",   bg: "bg-blue-50",     border: "border-blue-200"    },
  { value: "especes",        label: "Espèces",            icon: FiDollarSign,   color: "text-emerald-600",bg: "bg-emerald-50",  border: "border-emerald-200" },
];

// ─── Options de tri ───────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "created_at", label: "Date d'ajout"  },
  { value: "ticket_num", label: "N° Ticket"     },
  { value: "contact_last_name", label: "Nom client" },
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

// ─── Calcule les totaux financiers depuis les transactions comptabilité ───────
function computeFinancesFromHistory(history, montantTotalCents) {
  let totalEncaisseCents = 0;
  let totalAnnuleCents   = 0;

  history.forEach(tx => {
    const montant = Number(tx.montant_cents) || 0;
    if (tx.type_mouvement === 'encaissement' && montant > 0) {
      totalEncaisseCents += montant;
    } else if (tx.type_mouvement === 'annulation' && montant < 0) {
      totalAnnuleCents += Math.abs(montant);
    }
  });

  const netEncaisseCents = totalEncaisseCents - totalAnnuleCents;
  const prixVenteCents   = Number(montantTotalCents) || 0;
  const resteAPayer      = Math.max(0, prixVenteCents - netEncaisseCents);

  return {
    totalEncaisseCents,
    totalAnnuleCents,
    netEncaisseCents,
    prixVenteCents,
    resteAPayerCents: resteAPayer,
    totalEncaisse: totalEncaisseCents / 100,
    totalAnnule:   totalAnnuleCents / 100,
    netEncaisse:   netEncaisseCents / 100,
    prixVente:     prixVenteCents / 100,
    resteAPayer:   resteAPayer / 100,
    estSolde:      resteAPayer <= 5,
  };
}

export default function Tableau({ changeTab, userRole }) {
  const { showNotification } = useNotification();
  const [commandes, setCommandes]           = useState([]);
  const [joursConfig, setJoursConfig]       = useState([]);
  const [creneauxConfig, setCreneauxConfig] = useState([]);
  const [loading, setLoading]               = useState(true);

  // ── Filtres existants ──────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDate, setFilterDate]           = useState("");
  const [filterCreneauId, setFilterCreneauId] = useState("");
  const [filterStatut, setFilterStatut]       = useState("");

  // ── Filtres source de paiement + tri ─────────────────────────────────────
  const [filterSource, setFilterSource]       = useState("");
  const [sortField, setSortField]             = useState("created_at");
  const [sortDir, setSortDir]                 = useState("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ── Comptabilité pour le filtre source ───────────────────────────────────
  const [commandePaymentSources, setCommandePaymentSources] = useState({});
  const [loadingPaymentSources, setLoadingPaymentSources]   = useState(false);

  const [limit, setLimit]     = useState(50);
  const [hasMore, setHasMore] = useState(true);

  const [selectedOrder, setSelectedOrder]       = useState(null);
  const [orderHistory, setOrderHistory]         = useState([]);
  const [computedFinances, setComputedFinances] = useState(null);
  const [loadingHistory, setLoadingHistory]     = useState(false);
  const [sendingMail, setSendingMail]           = useState(false);
  const [isDeleting, setIsDeleting]             = useState(false);

  const [isEditing, setIsEditing]       = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isSaving, setIsSaving]         = useState(false);

  // ── NOUVEAU : États pour la note interne (édition rapide) ─────────────────
  const [noteDraft, setNoteDraft]         = useState("");
  const [editingNote, setEditingNote]     = useState(false);
  const [savingNote, setSavingNote]       = useState(false);

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

  // ── Fetch sources de paiement depuis comptabilite ─────────────────────────
  useEffect(() => {
    fetchPaymentSources();
  }, []);

  async function fetchPaymentSources() {
    setLoadingPaymentSources(true);
    try {
      const { data, error } = await supabase
        .from('comptabilite')
        .select('commande_id, moyen_paiement')
        .eq('type_mouvement', 'encaissement')
        .gt('montant_cents', 0);
      if (error) throw error;

      const map = {};
      (data || []).forEach(tx => {
        if (!tx.commande_id) return;
        if (!map[tx.commande_id]) map[tx.commande_id] = new Set();
        map[tx.commande_id].add(tx.moyen_paiement);
      });
      const result = {};
      Object.keys(map).forEach(k => { result[k] = Array.from(map[k]); });
      setCommandePaymentSources(result);
    } catch (err) {
      console.error("Erreur chargement sources paiement", err);
    } finally {
      setLoadingPaymentSources(false);
    }
  }

  // ── Fetch principal ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    const sub = supabase.channel('table_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [limit, debouncedSearch, filterDate, filterCreneauId, sortField, sortDir]);

  useEffect(() => {
    if (filterSource && Object.keys(commandePaymentSources).length === 0) {
      fetchPaymentSources();
    }
  }, [filterSource]);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase
        .from("commandes")
        .select(`*, creneaux_horaires ( date, heure_debut )`, { count: 'exact' })
        .not("contact_last_name", "is", null)
        .neq("contact_last_name", "")
        .neq("statut", "disponible")
        .neq("statut", "brouillon");
        // SUPPRIMÉ : .neq("statut", "en_attente") pour afficher les résas guichet sans encaissement

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
          ? query.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,note_interne.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`)
          : query.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,note_interne.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query
        .order(sortField, { ascending: sortDir === 'asc' })
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

  // ── Filtre statut + source côté client ────────────────────────────────────
  const filteredCommandes = useMemo(() => {
    let result = commandes;
    if (filterStatut) {
      result = result.filter(cmd => getStatutMetier(cmd) === filterStatut);
    }
    if (filterSource) {
      result = result.filter(cmd => {
        const sources = commandePaymentSources[cmd.id] || [];
        return sources.includes(filterSource);
      });
    }
    return result;
  }, [commandes, filterStatut, filterSource, commandePaymentSources]);

  const countsByStatut = useMemo(() => {
    const counts = { attente: 0, reserve: 0, paye: 0, bouclee: 0, annule: 0 };
    commandes.forEach(cmd => {
      const s = getStatutMetier(cmd);
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [commandes]);

  const countsBySource = useMemo(() => {
    const counts = { stripe_web: 0, stripe_guichet: 0, cb: 0, especes: 0 };
    commandes.forEach(cmd => {
      const sources = commandePaymentSources[cmd.id] || [];
      sources.forEach(s => {
        if (s in counts) counts[s]++;
      });
    });
    return counts;
  }, [commandes, commandePaymentSources]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getJourLabel = (dateStr) => {
    if (!dateStr) return "-";
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `Jour ${j.numero}` : "Jour Inconnu";
  };

  const uniqueDates = [...new Set(creneauxConfig.map(c => c.date))];

  const handleSortToggle = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setLimit(50);
  };

  // ── Chargement historique ─────────────────────────────────────────────────
  const handleRowClick = async (cmd) => {
    setSelectedOrder(cmd);
    setLoadingHistory(true);
    setComputedFinances(null);
    setIsEditing(false);
    // ── NOUVEAU : initialiser le brouillon de note ───────────────────────────
    setNoteDraft(cmd.note_interne || "");
    setEditingNote(false);
    try {
      const { data, error } = await supabase
        .from('comptabilite')
        .select('*')
        .eq('commande_id', cmd.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const history = data || [];
      setOrderHistory(history);
      const finances = computeFinancesFromHistory(history, cmd.montant_total_cents);
      setComputedFinances(finances);
    } catch (err) {
      console.error(err);
      showNotification("Erreur chargement historique", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseModal  = () => { 
    setSelectedOrder(null); 
    setIsEditing(false); 
    setComputedFinances(null);
    setEditingNote(false);
    setNoteDraft("");
  };

  const startEditing = () => {
    setEditFormData({ 
      ...selectedOrder, 
      montant_total_euros: (selectedOrder.montant_total_cents / 100).toFixed(2),
      note_interne: selectedOrder.note_interne || ""
    });
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
        note_interne:        editFormData.note_interne || null,
      };
      const { data, error } = await supabase
        .from('commandes').update(updatedData).eq('id', selectedOrder.id)
        .select('*, creneaux_horaires(date, heure_debut)').single();
      if (error) throw error;
      showNotification("Modifications enregistrées avec succès", "success");
      logAction('MODIFICATION', 'COMMANDE', { action: 'Modification manuelle du dossier', ticket: selectedOrder.ticket_num });
      const finances = computeFinancesFromHistory(orderHistory, data.montant_total_cents);
      setComputedFinances(finances);
      setSelectedOrder(data);
      setNoteDraft(data.note_interne || "");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de la sauvegarde", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ── NOUVEAU : Sauvegarde rapide de la note (indépendante du mode édition) ─
  const handleSaveNote = async () => {
    if (!selectedOrder) return;
    setSavingNote(true);
    try {
      const cleanNote = noteDraft.trim() || null;
      const { data, error } = await supabase
        .from('commandes')
        .update({ note_interne: cleanNote })
        .eq('id', selectedOrder.id)
        .select('*, creneaux_horaires(date, heure_debut)')
        .single();
      if (error) throw error;

      setSelectedOrder(data);
      setNoteDraft(data.note_interne || "");
      setEditingNote(false);
      showNotification(
        cleanNote ? "Note enregistrée ✓" : "Note supprimée",
        "success"
      );
      logAction('MODIFICATION', 'COMMANDE', { 
        action: cleanNote ? 'Ajout/modification note interne' : 'Suppression note interne', 
        ticket: selectedOrder.ticket_num 
      });

      // Met à jour la liste locale pour refléter le changement sans recharger
      setCommandes(prev => prev.map(c => 
        c.id === selectedOrder.id ? { ...c, note_interne: cleanNote } : c
      ));
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de la sauvegarde de la note", "error");
    } finally {
      setSavingNote(false);
    }
  };

  const handleCancelNote = () => {
    setNoteDraft(selectedOrder?.note_interne || "");
    setEditingNote(false);
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
          email: selectedOrder.contact_email, subject: customMailSubject,
          message: customMailBody, firstName: selectedOrder.contact_first_name, lastName: selectedOrder.contact_last_name
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
      setComputedFinances(null);
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
      .neq("statut", "brouillon");
      // SUPPRIMÉ : .neq("statut", "en_attente") pour s'assurer que l'export contienne aussi les résas guichet

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
        ? exportQuery.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,note_interne.ilike.%${debouncedSearch}%,ticket_num.eq.${debouncedSearch}`)
        : exportQuery.or(`contact_phone.ilike.%${debouncedSearch}%,contact_last_name.ilike.%${debouncedSearch}%,contact_first_name.ilike.%${debouncedSearch}%,contact_email.ilike.%${debouncedSearch}%,numero_boucle.ilike.%${debouncedSearch}%,stripe_ref.ilike.%${debouncedSearch}%,note_interne.ilike.%${debouncedSearch}%`);
    }

    const { data: allData, error } = await exportQuery.order(sortField, { ascending: sortDir === 'asc' });
    if (error) { showNotification("Erreur lors de l'export", "error"); return; }

    let exportData = allData;
    if (filterStatut) exportData = exportData.filter(cmd => getStatutMetier(cmd) === filterStatut);
    if (filterSource) exportData = exportData.filter(cmd => (commandePaymentSources[cmd.id] || []).includes(filterSource));

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registre Abattoir');
    worksheet.columns = [
      { header: 'Ticket',         key: 'ticket',   width: 12 },
      { header: 'Client',         key: 'client',   width: 25 },
      { header: 'Téléphone',      key: 'phone',    width: 15 },
      { header: 'Email',          key: 'email',    width: 30 },
      { header: 'Sacrifice',      key: 'sacrifice',width: 20 },
      { header: 'Boucle',         key: 'boucle',   width: 15 },
      { header: 'Date Retrait',   key: 'retrait',  width: 25 },
      { header: 'Acompte',        key: 'acompte',  width: 12 },
      { header: 'Payé Total',     key: 'paye',     width: 12 },
      { header: 'Reste à payer',  key: 'reste',    width: 15 },
      { header: 'Statut',         key: 'statut',   width: 20 },
      { header: 'Source Paiement',key: 'source',   width: 20 },
      { header: 'Note interne',   key: 'note',     width: 40 },
      { header: 'Date Réservation',key: 'date_resa',width: 20 },
      { header: 'Ref Stripe',     key: 'stripe',   width: 35 },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    exportData.forEach(c => {
      const dejaPaye = (Number(c.montant_paye_cents) || 0) / 100;
      const total    = (Number(c.montant_total_cents) || 0) / 100;
      const reste    = Math.max(0, total - dejaPaye);
      const sources  = commandePaymentSources[c.id] || [];
      let statutFr = "En Attente", rowColorArgb = null;
      if (c.statut === 'annule')                      { statutFr = 'Annulé';          rowColorArgb = 'FFFEE2E2'; }
      else if (c.statut === 'bouclee')                { statutFr = 'Bouclée';         rowColorArgb = 'FFDBEAFE'; }
      else if (reste <= 0.05 && dejaPaye > 0)         { statutFr = 'Totalement Payé'; rowColorArgb = 'FFD1FAE5'; }
      else if (dejaPaye > 0)                          { statutFr = 'Réservé';         rowColorArgb = 'FFFFEDD5'; }
      const row = worksheet.addRow({
        ticket:    c.ticket_num,
        client:    `${c.contact_last_name} ${c.contact_first_name}`,
        phone:     c.contact_phone,
        email:     c.contact_email,
        sacrifice: c.sacrifice_name,
        boucle:    c.numero_boucle || c.ticket_num,
        retrait:   c.creneaux_horaires ? `${getJourLabel(c.creneaux_horaires.date)} à ${c.creneaux_horaires.heure_debut.slice(0, 5)}` : "-",
        acompte:   `${(c.acompte_cents / 100).toFixed(2)} €`,
        paye:      `${dejaPaye.toFixed(2)} €`,
        reste:     `${reste.toFixed(2)} €`,
        statut:    statutFr,
        source:    sources.join(', ') || '-',
        note:      c.note_interne || '',
        date_resa: new Date(c.created_at).toLocaleString('fr-FR'),
        stripe:    c.stripe_ref || "",
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

  const renderSourcesBadges = (cmdId) => {
    const sources = commandePaymentSources[cmdId] || [];
    if (sources.length === 0) return <span className="text-slate-300 text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {sources.map(src => {
          const conf = PAYMENT_SOURCES.find(p => p.value === src);
          if (!conf || !conf.value) return null;
          const Icon = conf.icon;
          return (
            <span key={src} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${conf.bg} ${conf.color} ${conf.border}`}>
              {Icon && <Icon className="text-[10px]" />}
              {conf.label}
            </span>
          );
        })}
      </div>
    );
  };

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

  const hasActiveFilters = filterDate || filterCreneauId || filterStatut || debouncedSearch || filterSource;
  const resetFilters = () => {
    setFilterDate(""); setFilterCreneauId(""); setFilterStatut(""); setSearchTerm(""); setFilterSource(""); setLimit(50);
  };

  const SortButton = ({ field, label }) => {
    const isActive = sortField === field;
    return (
      <button
        onClick={() => handleSortToggle(field)}
        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
          isActive
            ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
      >
        {label}
        {isActive ? (
          sortDir === 'asc'
            ? <FiArrowUp className="text-sm" />
            : <FiArrowDown className="text-sm" />
        ) : (
          <FiArrowDown className="text-sm opacity-30" />
        )}
      </button>
    );
  };

  // Détection s'il y a déjà une note sur la commande (pour afficher un indicateur dans la liste)
  const hasNote = (cmd) => cmd.note_interne && cmd.note_interne.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fade-in">

      {/* ── En-tête ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-teal-500 rounded-2xl text-white shadow-lg shadow-teal-500/30"><FiList className="text-2xl" /></div>
            Registre des Commandes
          </h2>
          {/* PETITE MODIF ICI POUR REFLÉTER LE CHANGEMENT DE RÈGLE */}
          <p className="text-slate-500 text-sm mt-2 ml-1 font-medium">Toutes les réservations, y compris celles en attente d'encaissement, sont affichées.</p>
        </div>
        <button onClick={exportToExcel} className="shrink-0 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl transition-colors font-bold shadow-lg shadow-slate-900/20">
          <FiDownload /> Excel
        </button>
      </div>

      {/* ── Barre de filtres principale ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-4">

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

          <button
            onClick={() => setShowAdvancedFilters(prev => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
              showAdvancedFilters || filterSource
                ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
            }`}
          >
            <FiSliders className="text-sm" />
            Filtres avancés
            {filterSource && <span className="w-2 h-2 bg-teal-500 rounded-full"></span>}
          </button>

          <div className="relative flex-1 min-w-[200px] group">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
            <input type="text" placeholder="Nom, email, tél, #ticket, note..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium" />
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

        {showAdvancedFilters && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4 animate-fade-in">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FiCreditCard className="text-teal-500" /> Source de paiement
                {loadingPaymentSources && <FiLoader className="animate-spin text-slate-400 text-sm" />}
              </p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_SOURCES.map(src => {
                  const Icon = src.icon;
                  const count = src.value ? countsBySource[src.value] : filteredCommandes.length;
                  const isActive = filterSource === src.value;
                  return (
                    <button
                      key={src.value}
                      onClick={() => { setFilterSource(src.value); setLimit(50); }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        isActive
                          ? `${src.bg} ${src.color} ${src.border} ring-2 ring-offset-1 ring-current shadow-sm`
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {Icon && <Icon className="text-base" />}
                      <span>{src.label}</span>
                      {src.value && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-current/10 text-current' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FiArrowDown className="text-teal-500" /> Trier par
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                {SORT_OPTIONS.map(opt => (
                  <SortButton key={opt.value} field={opt.value} label={opt.label} />
                ))}
                <div className="ml-2 h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                <button
                  onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 transition-all"
                >
                  {sortDir === 'asc' ? (
                    <><FiArrowUp className="text-teal-500" /> Croissant</>
                  ) : (
                    <><FiArrowDown className="text-teal-500" /> Décroissant</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 items-center">
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
            {filterSource && (
              <span className="ml-2 text-teal-600 font-bold">
                · filtré par {PAYMENT_SOURCES.find(p => p.value === filterSource)?.label}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── Tableau principal ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="p-5">
                  <button onClick={() => handleSortToggle('ticket_num')} className="flex items-center gap-1 hover:text-teal-600 transition-colors group">
                    Ticket
                    {sortField === 'ticket_num'
                      ? sortDir === 'asc' ? <FiArrowUp className="text-teal-500" /> : <FiArrowDown className="text-teal-500" />
                      : <FiArrowDown className="opacity-0 group-hover:opacity-30" />}
                  </button>
                </th>
                <th className="p-5">
                  <button onClick={() => handleSortToggle('contact_last_name')} className="flex items-center gap-1 hover:text-teal-600 transition-colors group">
                    Client
                    {sortField === 'contact_last_name'
                      ? sortDir === 'asc' ? <FiArrowUp className="text-teal-500" /> : <FiArrowDown className="text-teal-500" />
                      : <FiArrowDown className="opacity-0 group-hover:opacity-30" />}
                  </button>
                </th>
                <th className="p-5 hidden sm:table-cell">Contact</th>
                <th className="p-5 hidden md:table-cell">Retrait Prévu</th>
                <th className="p-5 hidden lg:table-cell">Source Paiement</th>
                <th className="p-5">Boucle</th>
                <th className="p-5 text-right">Reste / Payé</th>
                <th className="p-5 text-center">Statut</th>
                <th className="p-5 hidden xl:table-cell">
                  <button onClick={() => handleSortToggle('created_at')} className="flex items-center gap-1 hover:text-teal-600 transition-colors group">
                    Ajouté le
                    {sortField === 'created_at'
                      ? sortDir === 'asc' ? <FiArrowUp className="text-teal-500" /> : <FiArrowDown className="text-teal-500" />
                      : <FiArrowDown className="opacity-0 group-hover:opacity-30" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading && commandes.length === 0 ? (
                <tr><td colSpan="9" className="p-12 text-center text-slate-400 font-bold animate-pulse">Chargement en cours...</td></tr>
              ) : filteredCommandes.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FiFilter className="text-4xl text-slate-300" />
                      <p className="text-slate-400 font-medium">Aucune réservation pour ces critères.</p>
                      {hasActiveFilters && (
                        <button onClick={resetFilters} className="text-teal-600 text-sm font-bold hover:underline">
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCommandes.map(cmd => {
                  const dejaPaye = (Number(cmd.montant_paye_cents) || 0) / 100;
                  const total    = (Number(cmd.montant_total_cents) || 0) / 100;
                  const reste    = Math.max(0, total - dejaPaye);
                  return (
                    <tr key={cmd.id} onClick={() => handleRowClick(cmd)} className={getRowClassName(cmd, dejaPaye, reste)}>
                      <td className="p-5 font-black text-teal-600 dark:text-teal-400 text-base">
                        <div className="flex items-center gap-2">
                          #{cmd.ticket_num}
                          {hasNote(cmd) && (
                            <span title="Note interne présente" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] shadow-sm">
                              <FiEdit3 className="text-[10px]" />
                            </span>
                          )}
                        </div>
                      </td>
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
                      <td className="p-5 hidden lg:table-cell">
                        {renderSourcesBadges(cmd.id)}
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
                      <td className="p-5 hidden xl:table-cell">
                        <p className="text-xs text-slate-500 font-medium">
                          {new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-slate-400 text-sm font-medium">Créé le {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}</p>
                  {(commandePaymentSources[selectedOrder.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(commandePaymentSources[selectedOrder.id] || []).map(src => {
                        const conf = PAYMENT_SOURCES.find(p => p.value === src);
                        if (!conf || !conf.value) return null;
                        const Icon = conf.icon;
                        return (
                          <span key={src} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${conf.bg} ${conf.color} ${conf.border}`}>
                            {Icon && <Icon className="text-[10px]" />}
                            {conf.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
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

              {/* ═════════════ NOTE INTERNE (rapide, indépendante du mode édition) ═════════════ */}
              {!isEditing && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h4 className="font-bold text-amber-800 dark:text-amber-300 uppercase text-xs tracking-wider flex items-center gap-2">
                      <FiEdit3 /> Note interne
                      <span className="text-[9px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded normal-case tracking-normal">
                        Privée staff
                      </span>
                    </h4>
                    {!editingNote && (
                      <button
                        onClick={() => setEditingNote(true)}
                        className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                      >
                        <FiEdit3 /> {selectedOrder.note_interne ? "Modifier" : "Ajouter"}
                      </button>
                    )}
                  </div>

                  {editingNote ? (
                    <div className="space-y-3 animate-fade-in">
                      <textarea
                        autoFocus
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Ex: Client arrivera en retard — prévenir avec appel — mouton à séparer du lot du matin..."
                        rows="4"
                        className="w-full p-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none text-sm font-medium"
                      />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          {noteDraft.length} caractère{noteDraft.length > 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelNote}
                            disabled={savingNote}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleSaveNote}
                            disabled={savingNote}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {savingNote ? <FiLoader className="animate-spin" /> : <FiSave />}
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {selectedOrder.note_interne ? (
                        <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap leading-relaxed font-medium bg-white/60 dark:bg-slate-900/40 p-3 rounded-xl border border-amber-100 dark:border-amber-900/50">
                          {selectedOrder.note_interne}
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600 dark:text-amber-500 italic">
                          Aucune note pour le moment. Cliquez sur <strong>Ajouter</strong> pour laisser un commentaire interne.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                      {/* Champ note interne aussi disponible dans le mode édition complet */}
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                          <FiEdit3 className="text-amber-500" /> Note interne
                        </label>
                        <textarea
                          value={editFormData.note_interne || ""}
                          onChange={e => setEditFormData({ ...editFormData, note_interne: e.target.value })}
                          rows="3"
                          placeholder="Note privée staff..."
                          className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500 resize-none"
                        />
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
                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2">
                    <FiDollarSign /> État Financier
                    <span className="ml-auto text-[9px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">comptabilite</span>
                  </h4>

                  {isEditing ? (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Prix de vente total (€)</label>
                      <input type="number" step="0.01" value={editFormData.montant_total_euros} onChange={e => setEditFormData({ ...editFormData, montant_total_euros: e.target.value })} className="w-full p-2.5 text-sm border-2 rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none focus:border-amber-500" />
                      <p className="text-[10px] text-amber-600 mt-1.5 font-medium leading-tight">Attention : changer ce prix recalculera le "Reste à payer".</p>
                    </div>
                  ) : loadingHistory ? (
                    <div className="flex items-center justify-center py-6">
                      <FiLoader className="animate-spin text-teal-500 text-2xl" />
                    </div>
                  ) : computedFinances ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500">Prix de vente</span>
                        <span className="font-bold dark:text-white">{computedFinances.prixVente.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between items-center text-sm py-1.5">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                          Encaissements
                        </span>
                        <span className="font-bold text-emerald-600">+{computedFinances.totalEncaisse.toFixed(2)} €</span>
                      </div>
                      {computedFinances.totalAnnule > 0 && (
                        <div className="flex justify-between items-center text-sm py-1.5">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                            Annulations
                          </span>
                          <span className="font-bold text-red-500">-{computedFinances.totalAnnule.toFixed(2)} €</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm py-1.5 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">Net encaissé</span>
                        <span className="font-black text-teal-600 dark:text-teal-400">{computedFinances.netEncaisse.toFixed(2)} €</span>
                      </div>
                      <div className={`flex justify-between items-center px-3 py-3 rounded-xl mt-1 ${
                        computedFinances.estSolde
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                      }`}>
                        <span className={`text-sm font-bold ${computedFinances.estSolde ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400'}`}>
                          {computedFinances.estSolde ? '✅ Soldé' : '⏳ Reste à payer'}
                        </span>
                        <span className={`text-xl font-black ${computedFinances.estSolde ? 'text-emerald-600' : 'text-orange-600 dark:text-orange-400'}`}>
                          {computedFinances.estSolde ? '0.00 €' : `${computedFinances.resteAPayer.toFixed(2)} €`}
                        </span>
                      </div>
                      {selectedOrder.stripe_ref && (
                        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><FiLink /> Réf. Paiement Stripe</p>
                          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all select-all">{selectedOrder.stripe_ref}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500">Prix de vente</span>
                        <span className="font-bold dark:text-white">{(selectedOrder.montant_total_cents / 100).toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between items-center px-3 py-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 mt-2">
                        <span className="text-sm font-bold text-orange-700 dark:text-orange-400">⏳ Reste à payer</span>
                        <span className="text-xl font-black text-orange-600">{(selectedOrder.montant_total_cents / 100).toFixed(2)} €</span>
                      </div>
                      <p className="text-[10px] text-slate-400 text-center italic mt-1">Aucune transaction enregistrée</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Historique paiements */}
              {!isEditing && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <FiClock className="text-indigo-500" /> Historique des transactions
                      <span className="text-xs text-slate-400 font-medium ml-1">(table <code className="font-mono">comptabilite</code>)</span>
                    </h4>
                    {orderHistory.length > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold">
                        {orderHistory.length} ligne{orderHistory.length > 1 ? 's' : ''}
                      </span>
                    )}
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
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ml-1 ${
                                  tx.type_mouvement === 'encaissement' ? 'bg-emerald-100 text-emerald-700' :
                                  tx.type_mouvement === 'annulation'   ? 'bg-red-100 text-red-700' :
                                  'bg-slate-200 text-slate-600'
                                }`}>
                                  {tx.type_mouvement}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1">Le {new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                              <p className="text-xs text-slate-400 mt-0.5">par <strong className="text-slate-600 dark:text-slate-300">{tx.operateur_email}</strong></p>
                              {tx.motif && <p className="text-xs text-red-600 font-bold bg-red-50 dark:bg-red-900/20 inline-block px-2 py-1 rounded mt-1.5">Motif : {tx.motif}</p>}
                              {tx.notes && !tx.motif && <p className="text-[11px] text-slate-400 italic mt-1">{tx.notes}</p>}
                              {tx.reference_externe && <p className="text-[10px] text-indigo-400 font-mono mt-1 truncate max-w-[200px]" title={tx.reference_externe}>Ref : {tx.reference_externe}</p>}
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