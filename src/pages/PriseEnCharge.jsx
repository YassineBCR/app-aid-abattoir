import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QRCodeCanvas } from "qrcode.react";
import { 
  FiSearch, FiCheckCircle, FiCamera, FiX, FiArrowRight, 
  FiList, FiArrowLeft, FiCreditCard, FiDollarSign, FiFileText, FiClock,
  FiTrash2, FiAlertTriangle, FiLock, FiUnlock, FiArchive, FiUser, FiPlus, FiPrinter,
  FiSmartphone, FiRefreshCw, FiCopy, FiExternalLink, FiCheck, FiEyeOff
} from "react-icons/fi";
import { logAction } from "../lib/logger";

export default function PriseEnCharge() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  
  const [activeCaisse, setActiveCaisse] = useState(null);
  const [showOuvertureModal, setShowOuvertureModal] = useState(false);
  const [showClotureModal, setShowClotureModal] = useState(false);
  const [fondDeCaisse, setFondDeCaisse] = useState("");
  const [reelEspeces, setReelEspeces] = useState("");
  const [reelCb, setReelCb] = useState("");
  const [justification, setJustification] = useState("");
  const [theoriqueCaisse, setTheoriqueCaisse] = useState({ especes: 0, cb: 0 });

  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  const [searchResults, setSearchResults] = useState([]); 
  const [historique, setHistorique] = useState([]);
  const [categorieChoisie, setCategorieChoisie] = useState("");
  const [loadingCategorie, setLoadingCategorie] = useState(false);
  
  const [joursConfig, setJoursConfig] = useState([]);

  const [montantEncaisse, setMontantEncaisse] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [loadingPaiement, setLoadingPaiement] = useState(false);

  // ── Stripe guichet ──────────────────────────────────────────────
  const [stripeModal, setStripeModal] = useState(null);
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // ────────────────────────────────────────────────────────────────

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loadingCancel, setLoadingCancel] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creneauxDispo, setCreneauxDispo] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [newResaForm, setNewResaForm] = useState({
    first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "",
    creneau_id: "", tarif_categorie: "", prix_cents: 0
  });

  useEffect(() => {
    checkActiveCaisse();
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: tarifsData } = await supabase.from("tarifs").select("*").order("prix_cents");
        setTarifs(tarifsData || []);
        const { data: joursData } = await supabase.from("jours_fete").select("*");
        setJoursConfig(joursData || []);
      } catch (err) {
        showNotification("Erreur de chargement des configurations.", "error");
      }
    };
    fetchInitialData();
  }, [showNotification]);

  const checkActiveCaisse = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email);
    const { data } = await supabase.from('caisses_vendeurs').select('*').eq('vendeur_email', user.email).eq('statut', 'ouverte').maybeSingle();
    if (data) setActiveCaisse(data);
    else setActiveCaisse(null);
  };

  const handleSearch = async (e, overrideVal = null) => {
    if (e) e.preventDefault();
    const val = overrideVal || searchInput;
    if (!val) return;
    setLoading(true); setCommande(null); setSearchResults([]); setShowScanner(false);
    try {
      let query = supabase.from("commandes").select("*, creneaux_horaires(*)");
      const cleanVal = val.toString().trim();
      const isDigits = /^\d+$/.test(cleanVal);
      if (isDigits) {
        if (cleanVal.startsWith('0') || cleanVal.length > 5) query = query.ilike('contact_phone', `%${cleanVal}%`);
        else query = query.eq("ticket_num", parseInt(cleanVal));
      } else {
        query = query.or(`contact_last_name.ilike.%${cleanVal}%,contact_first_name.ilike.%${cleanVal}%,contact_email.ilike.%${cleanVal}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) showNotification("Aucun résultat.", "error");
      else if (data.length === 1) selectCommande(data[0]);
      else { setSearchResults(data); showNotification(`${data.length} résultats trouvés.`, "info"); }
    } catch (err) { showNotification("Erreur recherche.", "error"); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeCaisse) {
      const pendingId = sessionStorage.getItem('pending_commande_id');
      if (pendingId) {
        loadCommandeById(pendingId);
        sessionStorage.removeItem('pending_commande_id');
      }
    }
  }, [activeCaisse]);

  const loadHistorique = async (id) => {
    const { data } = await supabase.from('historique_paiements').select('*').eq('commande_id', id).order('date_paiement', { ascending: false });
    setHistorique(data || []);
  };

  const selectCommande = (cmd) => { 
    setCommande(cmd); 
    setSearchInput(cmd.ticket_num?.toString() || ""); 
    setMontantEncaisse(""); 
    setCategorieChoisie(cmd.categorie || "");
    loadHistorique(cmd.id);
  };
  
  const handleBackToList = () => { setCommande(null); setSearchInput(""); setMontantEncaisse(""); };

  const handleScan = (result) => {
    if (result) {
      const rawValue = result[0]?.rawValue || result?.rawValue || result;
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed.ticket_num) handleSearch(null, parsed.ticket_num);
          else if (parsed.id) loadCommandeById(parsed.id);
          else handleSearch(null, rawValue);
        } catch { handleSearch(null, rawValue); }
      }
    }
  };

  const loadCommandeById = async (uuid) => {
    setLoading(true);
    const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", uuid).maybeSingle();
    if (data) { selectCommande(data); setShowScanner(false); } 
    else { showNotification("Commande introuvable.", "error"); }
    setLoading(false);
  };

  const handleOuvrirCaisse = async (e) => {
    e.preventDefault();
    const fondCents = Math.round((parseFloat(fondDeCaisse) || 0) * 100);
    try {
      const { data, error } = await supabase.from('caisses_vendeurs').insert({
        vendeur_email: userEmail, fond_caisse_initial_cents: fondCents, statut: 'ouverte'
      }).select().single();
      if (error) throw error;
      setActiveCaisse(data);
      setShowOuvertureModal(false);
      showNotification("Caisse ouverte avec succès.", "success");
      logAction('CREATION', 'CAISSE', { action: 'Ouverture de caisse', fond_initial: fondCents / 100 });
    } catch (err) { showNotification("Erreur lors de l'ouverture de caisse.", "error"); }
  };

  const preparerCloture = async () => {
    const { data: transactions } = await supabase.from('historique_paiements').select('montant_cents, moyen_paiement').eq('caisse_id', activeCaisse.id);
    let sumEspeces = activeCaisse.fond_caisse_initial_cents || 0;
    let sumCb = 0;
    if (transactions) {
      transactions.forEach(tx => {
        if (tx.moyen_paiement === 'especes') sumEspeces += tx.montant_cents;
        if (tx.moyen_paiement === 'cb') sumCb += tx.montant_cents;
      });
    }
    setTheoriqueCaisse({ especes: sumEspeces, cb: sumCb });
    setShowClotureModal(true);
  };

  const handleCloturerCaisse = async (e) => {
    e.preventDefault();
    const reelEspecesCents = Math.round((parseFloat(reelEspeces) || 0) * 100);
    const reelCbCents = Math.round((parseFloat(reelCb) || 0) * 100);
    const ecartEspeces = reelEspecesCents - theoriqueCaisse.especes;
    const ecartCb = reelCbCents - theoriqueCaisse.cb;
    if ((ecartEspeces !== 0 || ecartCb !== 0) && !justification.trim()) {
      return showNotification("Un écart a été détecté. Une justification est obligatoire.", "error");
    }
    try {
      const { error } = await supabase.from('caisses_vendeurs').update({
        total_theorique_especes_cents: theoriqueCaisse.especes, total_theorique_cb_cents: theoriqueCaisse.cb,
        total_reel_especes_cents: reelEspecesCents, total_reel_cb_cents: reelCbCents,
        ecart_especes_cents: ecartEspeces, ecart_cb_cents: ecartCb,
        justification_ecart: justification, statut: 'cloturee', heure_cloture: new Date().toISOString()
      }).eq('id', activeCaisse.id);
      if (error) throw error;
      logAction('MODIFICATION', 'CAISSE', { action: 'Clôture de caisse', ecart_especes: ecartEspeces/100, ecart_cb: ecartCb/100, justification: justification });
      setActiveCaisse(null); setShowClotureModal(false); showNotification("Caisse clôturée.", "success"); setCommande(null);
    } catch (err) { showNotification("Erreur lors de la clôture.", "error"); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CORRECTION : openCreateModal — récupère le stock réel de chaque créneau
  // (tous les créneaux, online ET offline) en comptant les tickets 'disponible'
  // ─────────────────────────────────────────────────────────────────────────────
  const openCreateModal = async () => {
    if (!activeCaisse) return showNotification("Ouvrez votre caisse d'abord !", "error");
    setLoading(true);
    try {
      // 1. Tous les créneaux (online ET offline) — le guichet peut réserver sur n'importe lequel
      const { data: slots, error: slotsError } = await supabase
        .from("creneaux_horaires")
        .select("*")
        .order("date", { ascending: true })
        .order("heure_debut", { ascending: true });
        
      if (slotsError) throw slotsError;

      // 2. Compter les tickets 'disponible' par créneau pour afficher le vrai stock
      const { data: stockData } = await supabase
        .from("commandes")
        .select("creneau_id")
        .eq("statut", "disponible");

      const stockMap = {};
      (stockData || []).forEach(t => {
        stockMap[t.creneau_id] = (stockMap[t.creneau_id] || 0) + 1;
      });

      // 3. Fusionner : on ajoute places_restantes (stock réel) à chaque créneau
      const slotsWithStock = (slots || []).map(s => ({
        ...s,
        places_restantes: stockMap[s.id] || 0
      }));

      setCreneauxDispo(slotsWithStock);

      const { data: prix } = await supabase.from("tarifs").select("*").order("prix_cents");
      setTarifs(prix || []);
      setNewResaForm({ first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "", creneau_id: "", tarif_categorie: "", prix_cents: 0 });
      setShowCreateModal(true);
    } catch(err) { showNotification("Erreur de chargement des données.", "error"); } finally { setLoading(false); }
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!newResaForm.creneau_id || !newResaForm.tarif_categorie) return showNotification("Sélectionnez un créneau et un tarif.", "error");
    setLoadingCreate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("reserver_prochain_ticket", {
        p_creneau_id: newResaForm.creneau_id, 
        p_client_id: user.id, 
        p_nom: newResaForm.last_name, 
        p_prenom: newResaForm.first_name, 
        p_email: newResaForm.email || "surplace@abattoir.local",
        p_tel: newResaForm.phone, 
        p_sacrifice_name: newResaForm.sacrifice_name, 
        p_categorie: newResaForm.tarif_categorie, 
        p_montant_total_cents: newResaForm.prix_cents, 
        p_acompte_cents: 0
      });
      
      if (error) throw error;
      
      logAction('CREATION', 'COMMANDE', { ticket: data.ticket_num, source: 'guichet_sur_place', client: `${newResaForm.first_name} ${newResaForm.last_name}` });
      showNotification(`Réservation enregistrée ! Ticket N°${data.ticket_num}`, "success");
      
      setShowCreateModal(false);
      
      const { data: fullCmd } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", data.commande_id).single();
      if(fullCmd) selectCommande(fullCmd);
      
    } catch (err) { showNotification("Erreur lors de la création.", "error"); } finally { setLoadingCreate(false); }
  };

  // ── Encaissement standard (espèces / CB) ────────────────────────
  const validerPaiement = async (e) => {
    e.preventDefault();
    if (!activeCaisse) return showNotification("Ouvrez votre caisse !", "error");

    if (modePaiement === 'stripe') {
      return lancerPaiementStripe();
    }

    const montantAsaisi = parseFloat(montantEncaisse) || 0;
    if (montantAsaisi <= 0) return showNotification("Saisissez un montant.", "info");
    setLoadingPaiement(true);
    try {
      const montantAjouteCents = Math.round(montantAsaisi * 100);
      const { error: errHistory } = await supabase.from('historique_paiements').insert({
        commande_id: commande.id, caisse_id: activeCaisse.id, ticket_num: commande.ticket_num,
        montant_cents: montantAjouteCents, moyen_paiement: modePaiement, encaisse_par: userEmail
      });
      if (errHistory) throw errHistory;
      
      const ancienPayeCents = commande.montant_paye_cents ?? commande.acompte_cents ?? 0;
      const nouveauTotalPayeCents = ancienPayeCents + montantAjouteCents;
      
      let nouveauStatut = commande.statut;
      const tarifActuel = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);

      if (nouveauTotalPayeCents >= totalCents) { nouveauStatut = 'paye_integralement'; }
      else if (nouveauStatut === 'en_attente' && nouveauTotalPayeCents > 0) { nouveauStatut = 'acompte_paye'; }
      
      await supabase.from('commandes').update({ montant_paye_cents: nouveauTotalPayeCents, statut: nouveauStatut }).eq('id', commande.id);
      logAction('CREATION', 'CAISSE', { ticket: commande.ticket_num, montant_encaisse: montantAsaisi, moyen: modePaiement });
      showNotification("Paiement encaissé avec succès.", "success");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if(data) selectCommande(data);
    } catch (err) { showNotification("Erreur d'encaissement.", "error"); } finally { setLoadingPaiement(false); }
  };

  // ── Stripe guichet : génère un lien de paiement ─────────────────
  const lancerPaiementStripe = async () => {
    const montantAsaisi = parseFloat(montantEncaisse) || 0;
    if (montantAsaisi <= 0) return showNotification("Saisissez un montant avant de générer le lien Stripe.", "info");
    setLoadingPaiement(true);
    try {
      const montantCents = Math.round(montantAsaisi * 100);
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montantTotal: montantCents,
          panierId: commande.id,
          description: `Paiement guichet – Ticket N°${commande.ticket_num} (${commande.sacrifice_name})`,
          email: commande.contact_email || undefined
        }),
      });
      const data = await response.json();
      if (!data.url) throw new Error(data.error || "Réponse Stripe invalide");

      const sessionId = data.url.split("/pay/")[1]?.split("#")[0] || `guichet_${Date.now()}`;
      setStripeModal({ url: data.url, sessionId, montantCents });
    } catch (err) {
      showNotification("Erreur Stripe : " + err.message, "error");
    } finally {
      setLoadingPaiement(false);
    }
  };

  // ── Stripe guichet : vérifie si le client a payé ─────────────────
  const verifierPaiementStripe = async () => {
    if (!stripeModal) return;
    setCheckingStripe(true);
    try {
      const res = await fetch(`/api/verify-session/${stripeModal.sessionId}`);
      
      if (!res.ok) {
        await enregistrerPaiementStripe();
        return;
      }
      const session = await res.json();
      if (session.payment_status === 'paid') {
        await enregistrerPaiementStripe();
      } else {
        showNotification("Paiement pas encore effectué par le client.", "info");
      }
    } catch {
      await enregistrerPaiementStripe();
    } finally {
      setCheckingStripe(false);
    }
  };

  const enregistrerPaiementStripe = async () => {
    if (!stripeModal || !activeCaisse) return;
    try {
      const { montantCents } = stripeModal;

      const { data: existing } = await supabase
        .from('historique_paiements')
        .select('id')
        .eq('reference_externe', stripeModal.sessionId)
        .maybeSingle();

      if (existing) {
        showNotification("Ce paiement Stripe a déjà été enregistré.", "info");
        setStripeModal(null);
        return;
      }

      await supabase.from('historique_paiements').insert({
        commande_id: commande.id,
        caisse_id: activeCaisse.id,
        ticket_num: commande.ticket_num,
        montant_cents: montantCents,
        moyen_paiement: 'stripe',
        encaisse_par: userEmail,
        reference_externe: stripeModal.sessionId,
        notes: "Lien Stripe généré au guichet"
      });

      const ancienPayeCents = commande.montant_paye_cents ?? commande.acompte_cents ?? 0;
      const nouveauTotalPayeCents = ancienPayeCents + montantCents;
      const tarifActuel = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);
      const nouveauStatut = nouveauTotalPayeCents >= totalCents ? 'paye_integralement' : 'acompte_paye';

      await supabase.from('commandes').update({ montant_paye_cents: nouveauTotalPayeCents, statut: nouveauStatut }).eq('id', commande.id);

      logAction('CREATION', 'CAISSE', { ticket: commande.ticket_num, montant: montantCents / 100, moyen: 'stripe_guichet' });
      showNotification("Paiement Stripe confirmé et enregistré !", "success");
      setStripeModal(null);
      setMontantEncaisse("");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if (data) selectCommande(data);
    } catch (err) {
      showNotification("Erreur enregistrement : " + err.message, "error");
    }
  };

  const copierLien = () => {
    if (!stripeModal) return;
    navigator.clipboard.writeText(stripeModal.url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const appliquerCategorie = async () => {
    if (!commande) return;
    if (!categorieChoisie) return showNotification("Sélectionnez une catégorie.", "error");
    const tarif = tarifs.find(t => t.categorie === categorieChoisie);
    if (!tarif) return showNotification("Tarif introuvable pour cette catégorie.", "error");
    setLoadingCategorie(true);
    try {
      const { error } = await supabase.from("commandes").update({ categorie: categorieChoisie, montant_total_cents: tarif.prix_cents }).eq("id", commande.id);
      if (error) throw error;
      logAction('MODIFICATION', 'COMMANDE', { ticket: commande.ticket_num, nouvelle_categorie: categorieChoisie, nouveau_montant_total: tarif.prix_cents / 100 });
      showNotification("Catégorie appliquée. Montant mis à jour.", "success");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if (data) selectCommande(data);
    } catch (err) { showNotification("Erreur lors de l'application de la catégorie.", "error"); } finally { setLoadingCategorie(false); }
  };

  const promptAnnulerTransaction = (transaction) => {
    if (!activeCaisse) return showNotification("Caisse fermée.", "error");
    if (transaction.moyen_paiement === 'stripe') return showNotification("Impossible d'annuler un paiement Stripe ici. Utilisez le dashboard Stripe.", "error");
    setTransactionToCancel(transaction); setCancelReason(""); setShowCancelModal(true);
  };

  const confirmAnnulerTransaction = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return showNotification("Saisissez un motif.", "info");
    setLoadingCancel(true);
    try {
      const { error: errHistory } = await supabase.from('historique_paiements').insert({
        commande_id: commande.id, caisse_id: activeCaisse.id, ticket_num: commande.ticket_num,
        montant_cents: -Math.abs(transactionToCancel.montant_cents), moyen_paiement: transactionToCancel.moyen_paiement,
        encaisse_par: userEmail, notes: `Annulation : ${cancelReason}`
      });
      if (errHistory) throw errHistory;
      const ancienPayeCents = commande.montant_paye_cents ?? commande.acompte_cents ?? 0;
      const nouveauPayeCents = Math.max(0, ancienPayeCents - Math.abs(transactionToCancel.montant_cents));
      let nouveauStatut = commande.statut;
      const tarifActuel = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);
      if (nouveauPayeCents < totalCents && commande.statut === 'paye_integralement') { nouveauStatut = nouveauPayeCents > 0 ? 'acompte_paye' : 'en_attente'; }
      await supabase.from('commandes').update({ montant_paye_cents: nouveauPayeCents, statut: nouveauStatut }).eq('id', commande.id);
      logAction('SUPPRESSION', 'CAISSE', { ticket: commande.ticket_num, montant_annule: (transactionToCancel.montant_cents / 100), motif: cancelReason });
      showNotification("Annulation tracée.", "success");
      setShowCancelModal(false); setTransactionToCancel(null); loadCommandeById(commande.id);
    } catch (err) { showNotification("Erreur d'annulation.", "error"); } finally { setLoadingCancel(false); }
  };

  const getJourLabel = (dateStr) => {
    if (!dateStr) return "SANS CRÉNEAU";
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `JOUR ${j.numero}` : `JOUR INCONNU`;
  };

  const formatHeure = (heureStr) => {
    if (!heureStr) return "";
    const h = heureStr.slice(0, 2);
    const m = heureStr.slice(3, 5);
    return m === "00" ? `${h}H` : `${h}H${m}`;
  };

  const handlePrint = () => { window.print(); };

  const tarifActuel = commande ? tarifs.find(t => String(t.categorie) === String(commande.categorie)) : null;
  const total = commande ? (tarifActuel && tarifActuel.prix_cents ? (tarifActuel.prix_cents / 100) : (commande.montant_total_cents / 100)) : 0;
  const dejaPayeCents = commande ? (commande.montant_paye_cents ?? commande.acompte_cents ?? 0) : 0;
  const dejaPaye = dejaPayeCents / 100;
  const resteAPayer = Math.max(0, total - dejaPaye);
  const isPaye = resteAPayer <= 0.05;

  const getPaymentIcon = (moyen) => {
    switch(moyen) {
      case 'especes': return <FiDollarSign />;
      case 'cb': return <FiCreditCard />;
      case 'stripe': return <FiSmartphone />;
      default: return <FiFileText />;
    }
  };

  const MODES_PAIEMENT = [
    { key: 'especes', label: 'Espèces', icon: <FiDollarSign />, color: 'emerald' },
    { key: 'cb', label: 'Carte Bancaire', icon: <FiCreditCard />, color: 'blue' },
    { key: 'stripe', label: 'Lien Stripe', icon: <FiSmartphone />, color: 'purple' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 min-h-screen relative">
      
      {/* CSS impression */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 102mm 76mm; margin: 0; }
          body * { visibility: hidden; }
          #ticket-zebra, #ticket-zebra * { visibility: visible; }
          #ticket-zebra { position: absolute; left: 0; top: 0; width: 102mm; height: 76mm; padding: 3mm 4mm; display: block !important; background: white !important; color: black !important; font-family: Arial, Helvetica, sans-serif; box-sizing: border-box; text-align: center; overflow: hidden; }
          .no-print { display: none !important; }
        }
      `}} />

      {/* ═══════════ INTERFACE NORMALE ═══════════ */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 pt-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
               <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30"><FiCreditCard className="text-2xl" /></div>
               Caisse & Encaissement
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Encaissement espèces, CB ou lien Stripe.</p>
          </div>
          
          <div>
            {activeCaisse ? (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 p-2 pr-4 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white"><FiUnlock className="text-lg" /></div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase">Caisse Ouverte</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">Depuis {new Date(activeCaisse.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <button onClick={preparerCloture} className="ml-2 px-4 py-1.5 bg-white text-emerald-700 text-xs font-bold rounded-full shadow-sm hover:bg-emerald-100 transition-colors">Clôturer</button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-2 pr-4 rounded-full border border-slate-200 dark:border-slate-700">
                <div className="w-10 h-10 bg-slate-400 rounded-full flex items-center justify-center text-white"><FiLock className="text-lg" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Caisse Fermée</p>
                  <p className="text-xs text-slate-500">Encaissement bloqué</p>
                </div>
                <button onClick={() => setShowOuvertureModal(true)} className="ml-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-sm hover:bg-indigo-700 transition-colors">Ouvrir</button>
              </div>
            )}
          </div>
        </div>

        {!activeCaisse ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 animate-fade-in mt-8">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6"><FiLock className="text-5xl text-slate-400" /></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Votre caisse est fermée</h2>
            <p className="text-slate-500 mt-2 max-w-md text-center">Déclarez votre fond de caisse pour commencer à encaisser.</p>
            <button onClick={() => setShowOuvertureModal(true)} className="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center gap-2 transition-all"><FiUnlock /> Ouvrir ma caisse</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in mt-8">
            
            {/* ── Colonne gauche : recherche ── */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-800 p-1 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowScanner(true)} className="group w-full py-4 bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white rounded-2xl shadow-lg shadow-indigo-500/25 flex flex-col items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-95">
                      <div className="bg-white/20 p-2.5 rounded-full"><FiCamera className="text-xl" /></div>
                      <span className="font-bold text-sm tracking-wide">Scanner</span>
                    </button>
                    <button onClick={openCreateModal} className="group w-full py-4 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-lg shadow-emerald-500/25 flex flex-col items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-95">
                      <div className="bg-white/20 p-2.5 rounded-full"><FiPlus className="text-xl" /></div>
                      <span className="font-bold text-sm tracking-wide">Nouvelle Résa</span>
                    </button>
                  </div>
                  <div className="relative group">
                    <form onSubmit={(e) => handleSearch(e)} className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><FiSearch className="text-slate-400 text-xl" /></div>
                      <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="N° Ticket, Nom, Tél..." className="block w-full pl-12 pr-16 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-base font-bold outline-none focus:border-indigo-500 transition-all dark:text-white" />
                      <button type="submit" disabled={loading || !searchInput} className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center"><FiSearch className="text-xl" /></button>
                    </form>
                  </div>
                </div>
              </div>

              {!commande && searchResults.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden"> 
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                    <h3 className="font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-2"><FiList /> Résultats ({searchResults.length})</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {searchResults.map(res => (
                      <button key={res.id} onClick={() => selectCommande(res)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center group">
                        <div>
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm font-bold">#{res.ticket_num}</span>
                          <div className="text-sm font-medium text-slate-800 dark:text-white mt-1">{res.contact_last_name} {res.contact_first_name}</div>
                        </div>
                        <FiArrowRight className="text-slate-300 group-hover:text-indigo-500 text-xl" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite : dossier + encaissement ── */}
            <div className="xl:col-span-2">
              {commande ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-fade-in-up">
                  
                  <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <button onClick={handleBackToList} className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 rounded-lg shadow-sm border border-slate-200 transition-all"><FiArrowLeft className="text-lg" /></button>
                      <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xl">Dossier N°{commande.ticket_num}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {isPaye ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1"><FiCheckCircle /> Totalement Payé</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"><FiClock /> Paiement en attente</span>
                      )}
                      <button onClick={handleBackToList} className="hidden sm:flex px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition-colors">
                        Client Suivant
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
                    {/* Info client */}
                    <div className="lg:w-1/3 space-y-6">
                      <div className="text-center lg:text-left">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3 text-2xl text-slate-400"><FiUser /></div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{commande.contact_last_name} {commande.contact_first_name}</h2>
                        <p className="text-slate-500 text-sm mt-1">{commande.contact_phone}</p>
                        <span className="mt-3 inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">Sacrifice: {commande.sacrifice_name}</span>
                      </div>

                      {!isPaye && (
                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 space-y-3">
                          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-[0.14em]">Catégorie</p>
                          <select value={categorieChoisie} onChange={(e) => setCategorieChoisie(e.target.value)} className="w-full p-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 text-sm font-semibold outline-none focus:border-indigo-500 transition-all">
                            <option value="">Choisir une catégorie</option>
                            {tarifs.map(t => (<option key={t.categorie} value={t.categorie}>Cat. {t.categorie} ({(t.prix_cents/100).toFixed(2)} €)</option>))}
                          </select>
                          <button type="button" onClick={appliquerCategorie} disabled={loadingCategorie || !categorieChoisie} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-all">
                            {loadingCategorie ? "Application..." : "Appliquer"}
                          </button>
                        </div>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-700 pt-6 space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Prix Total</span><span className="font-bold dark:text-white">{total.toFixed(2)} €</span></div>
                        <div className="flex justify-between text-sm items-center"><span className="text-slate-500">Total Payé</span><span className="font-bold text-emerald-600">- {dejaPaye.toFixed(2)} €</span></div>
                        <div className="flex justify-between text-base pt-2 border-t border-slate-100 dark:border-slate-700">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Reste à payer</span>
                          <span className={`font-black ${resteAPayer < 0.05 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{resteAPayer < 0.05 ? "0.00 €" : `${resteAPayer.toFixed(2)} €`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Formulaire encaissement */}
                    <div className="lg:w-2/3 flex flex-col gap-6">
                      
                      {!isPaye ? (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                          <form onSubmit={validerPaiement} className="space-y-4">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"><FiCreditCard className="text-indigo-500" /> Nouvel Encaissement</label>
                            
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              {MODES_PAIEMENT.map(mode => (
                                <button key={mode.key} type="button" onClick={() => setModePaiement(mode.key)}
                                  className={`py-4 px-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2
                                    ${modePaiement === mode.key
                                      ? mode.key === 'stripe'
                                        ? "border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-600"
                                        : mode.key === 'cb'
                                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                                          : "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200"
                                      : "border-slate-200 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="text-2xl">{mode.icon}</div>
                                  <span className="text-xs font-bold leading-tight text-center">{mode.label}</span>
                                </button>
                              ))}
                            </div>

                            {modePaiement === 'stripe' && (
                              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                                <FiSmartphone className="text-purple-500 text-xl shrink-0" />
                                <p className="text-purple-700 dark:text-purple-300 font-medium">
                                  Un lien de paiement sera généré. Le client paie via son téléphone ou l'URL que vous lui partagez.
                                </p>
                              </div>
                            )}

                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><span className="text-slate-400 text-xl font-bold">€</span></div>
                              <input type="number" step="0.01" value={montantEncaisse} onChange={(e) => setMontantEncaisse(e.target.value)} className="block w-full pl-12 pr-28 py-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-2xl font-bold outline-none focus:border-indigo-500 dark:text-white shadow-sm" placeholder="0.00" />
                              <button type="button" onClick={() => setMontantEncaisse(resteAPayer.toFixed(2))} className="absolute right-3 top-3 bottom-3 px-4 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors">Le Solde</button>
                            </div>

                            <button type="submit" disabled={loadingPaiement || !montantEncaisse}
                              className={`w-full py-5 mt-2 font-bold text-lg rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50 text-white
                                ${modePaiement === 'stripe'
                                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'
                                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
                                }`}
                            >
                              {loadingPaiement ? "Traitement..." : modePaiement === 'stripe' ? <><FiSmartphone /> Générer le lien Stripe</> : <><FiCheckCircle /> Encaisser ce montant</>}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-fade-in shadow-inner">
                          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4"><FiCheckCircle className="text-3xl" /></div>
                          <h3 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400">Paiement Terminé</h3>
                          <p className="text-emerald-600 dark:text-emerald-500 mt-1 mb-6 font-medium">Le client a réglé la totalité de sa commande.</p>
                          <button onClick={handlePrint} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-lg shadow-xl shadow-slate-900/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 active:scale-95">
                            <FiPrinter className="text-2xl" /> IMPRIMER LE TICKET ZEBRA
                          </button>
                          <p className="text-[10px] text-red-500 uppercase tracking-wider mt-4 font-bold bg-red-100 p-2 rounded-lg inline-block">IMPORTANT : Choisir "Format : 102x76mm" à l'impression.</p>
                        </div>
                      )}

                      {/* Historique */}
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"><FiClock className="text-indigo-500" /> Historique des paiements</h4>
                        </div>
                        <div className="p-4 max-h-64 overflow-y-auto">
                          {historique.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-4">Aucun encaissement enregistré.</p>
                          ) : (
                            <div className="space-y-3">
                              {historique.map(tx => (
                                <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl border ${Number(tx.montant_cents) < 0 ? 'bg-red-50 border-red-100' : tx.moyen_paiement === 'stripe' ? 'bg-purple-50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-800/50' : 'bg-white border-slate-100'} dark:bg-slate-800 dark:border-slate-700 shadow-sm`}>
                                  <div>
                                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                      {Number(tx.montant_cents) < 0 ? <FiAlertTriangle className="text-red-500"/> : getPaymentIcon(tx.moyen_paiement)}
                                      {tx.moyen_paiement.toUpperCase()}
                                      {tx.moyen_paiement === 'stripe' && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-black">WEB</span>}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{new Date(tx.date_paiement).toLocaleString('fr-FR')} • {tx.encaisse_par.split('@')[0]}</p>
                                    {tx.notes && <p className="text-[11px] text-red-500 font-bold mt-0.5">{tx.notes}</p>}
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                    <span className={`font-black ${Number(tx.montant_cents) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {(Number(tx.montant_cents) / 100).toFixed(2)} €
                                    </span>
                                    {Number(tx.montant_cents) > 0 && tx.moyen_paiement !== 'stripe' && (
                                      <button onClick={() => promptAnnulerTransaction(tx)} className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors"><FiTrash2 className="text-base" /></button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-12 text-center opacity-70 animate-fade-in">
                  <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6 text-indigo-300 dark:text-slate-500"><FiCreditCard className="text-5xl" /></div>
                  <h3 className="text-xl font-bold text-slate-400">Guichet Caisse Prêt</h3>
                  <p className="text-slate-400 mt-2 max-w-sm mx-auto">Scannez un ticket ou créez une réservation pour encaisser.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ TICKET ZEBRA (impression) ═══════════ */}
      {commande && (
        <div id="ticket-zebra" style={{ display: 'none' }}>
          <div style={{ width: '100%', borderBottom: '2px solid black', paddingBottom: '2mm', marginBottom: '2mm' }}>
            <h1 style={{ fontSize: '13pt', fontWeight: '900', margin: 0, letterSpacing: '0.5px' }}>AÏD AL ADHA 2026</h1>
          </div>
          <div style={{ display: 'block', width: '100%', marginTop: '4mm' }}>
            <p style={{ fontSize: '16pt', fontWeight: 'bold', margin: '0 0 1mm 0' }}>Ticket :</p>
            <div style={{ fontSize: '65pt', fontWeight: '900', lineHeight: 1, margin: '0 0 4mm 0' }}>{commande.ticket_num}</div>
            <div style={{ fontSize: '20pt', fontWeight: 'bold', margin: '0 0 2mm 0', textTransform: 'uppercase' }}>
              {commande.creneaux_horaires ? `${getJourLabel(commande.creneaux_horaires.date)} - ${formatHeure(commande.creneaux_horaires.heure_debut)}` : "SANS CRÉNEAU"}
            </div>
            <div style={{ fontSize: '16pt', fontWeight: 'bold', margin: 0 }}>Catégorie {commande.categorie}</div>
          </div>
          <div style={{ position: 'absolute', bottom: '3mm', left: '3mm', right: '3mm', borderTop: '2px dashed black', paddingTop: '2mm' }}>
            <p style={{ fontSize: '8pt', fontWeight: 'bold', margin: '0 0 1mm 0', lineHeight: 1.1 }}>Aucun remboursement en cas de retard ou de saisie par la DDPP.</p>
            <p style={{ fontSize: '7pt', fontWeight: 'bold', margin: 0, lineHeight: 1.1 }}>Interdiction au sac poubelle, merci de respecter les règles d'hygiène.</p>
          </div>
        </div>
      )}

      {/* ═══════════ MODALE STRIPE GUICHET ═══════════ */}
      {stripeModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-purple-200 dark:border-purple-800">
            
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><FiSmartphone className="text-xl" /></div>
                  <div>
                    <h3 className="text-xl font-black">Lien Stripe Généré</h3>
                    <p className="text-purple-200 text-xs font-medium">Le client doit scanner ou cliquer le lien</p>
                  </div>
                </div>
                <button onClick={() => setStripeModal(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><FiX /></button>
              </div>
              <div className="bg-white/10 rounded-xl px-4 py-2 mt-2 text-center">
                <span className="text-2xl font-black">{(stripeModal.montantCents / 100).toFixed(2)} €</span>
                <span className="text-purple-200 text-sm ml-2">à encaisser</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Le client scanne ce QR code</p>
                <div className="bg-white p-4 rounded-2xl shadow-inner border-2 border-slate-100">
                  <QRCodeCanvas value={stripeModal.url} size={180} level="H" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
                <p className="text-xs font-mono text-slate-500 truncate flex-1">{stripeModal.url}</p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={copierLien} className={`p-2 rounded-lg transition-all text-sm font-bold flex items-center gap-1 ${copiedLink ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                    {copiedLink ? <><FiCheck /> Copié !</> : <><FiCopy /> Copier</>}
                  </button>
                  <a href={stripeModal.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"><FiExternalLink /></a>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button onClick={verifierPaiementStripe} disabled={checkingStripe}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {checkingStripe ? <><FiRefreshCw className="animate-spin" /> Vérification…</> : <><FiCheckCircle className="text-xl" /> Confirmer le paiement (Auto)</>}
                </button>
                
                <button onClick={enregistrerPaiementStripe}
                  className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <FiCheck className="text-lg" /> Forcer la validation (Vérifié manuellement)
                </button>

                <p className="text-center text-xs text-slate-400">
                  Le système vérifiera automatiquement via Stripe, ou vous pouvez valider manuellement si vous avez déjà constaté l'encaissement.
                </p>
                <button onClick={() => setStripeModal(null)} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm">
                  Fermer (le lien reste valide)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL CRÉATION RÉSERVATION ═══════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2"><FiPlus className="text-indigo-500"/> Créer une réservation</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 p-2 rounded-full"><FiX /></button>
            </div>
            <form onSubmit={handleCreateReservation} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Créneau <span className="text-red-500">*</span></label>
                  <select required value={newResaForm.creneau_id} onChange={e => setNewResaForm({...newResaForm, creneau_id: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white">
                    <option value="">-- Choisir un créneau --</option>
                    {creneauxDispo.map(c => (
                      <option key={c.id} value={c.id} disabled={c.places_restantes <= 0}>
                        {getJourLabel(c.date)} à {c.heure_debut.slice(0,5)}
                        {!c.is_online && ' 🔒'}
                        {' '}({c.places_restantes} ticket{c.places_restantes > 1 ? 's' : ''} en stock)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">🔒 = créneau hors ligne (non visible en ligne, réservable au guichet uniquement)</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Catégorie <span className="text-red-500">*</span></label>
                  <select required value={newResaForm.tarif_categorie} onChange={e => { const t = tarifs.find(tar => tar.categorie === e.target.value); setNewResaForm({...newResaForm, tarif_categorie: e.target.value, prix_cents: t ? t.prix_cents : 0}) }} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white">
                    <option value="">-- Choisir une catégorie --</option>
                    {tarifs.map(t => (<option key={t.categorie} value={t.categorie}>Cat. {t.categorie} - {t.nom} ({(t.prix_cents/100).toFixed(2)}€)</option>))}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Prénom <span className="text-red-500">*</span></label><input required type="text" value={newResaForm.first_name} onChange={e => setNewResaForm({...newResaForm, first_name: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white" /></div>
                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nom <span className="text-red-500">*</span></label><input required type="text" value={newResaForm.last_name} onChange={e => setNewResaForm({...newResaForm, last_name: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white" /></div>
                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Téléphone <span className="text-red-500">*</span></label><input required type="tel" value={newResaForm.phone} onChange={e => setNewResaForm({...newResaForm, phone: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white" /></div>
                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Optionnel)</label><input type="email" placeholder="client@email.com" value={newResaForm.email} onChange={e => setNewResaForm({...newResaForm, email: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nom pour le sacrifice <span className="text-red-500">*</span></label><input required type="text" placeholder="Ex: Famille X..." value={newResaForm.sacrifice_name} onChange={e => setNewResaForm({...newResaForm, sacrifice_name: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-indigo-500 dark:text-white" /></div>
              </div>
              <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                <span className="text-indigo-800 dark:text-indigo-300 font-bold">Total à encaisser ensuite :</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{(newResaForm.prix_cents/100).toFixed(2)} €</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Annuler</button>
                <button type="submit" disabled={loadingCreate} className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2 transition-all disabled:opacity-50">
                  {loadingCreate ? "Création..." : <>Enregistrer la réservation <FiCheck /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ MODALES STANDARD ═══════════ */}
      {showCancelModal && transactionToCancel && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0"><FiAlertTriangle className="text-2xl" /></div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white">Annuler l'encaissement</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              Vous annulez <strong className="text-slate-900 dark:text-white">{(transactionToCancel.montant_cents / 100).toFixed(2)} €</strong> payé en <strong className="uppercase">{transactionToCancel.moyen_paiement}</strong>. Cette action sera tracée dans votre caisse.
            </p>
            <form onSubmit={confirmAnnulerTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Motif de l'annulation <span className="text-red-500">*</span></label>
                <textarea required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex: Erreur de frappe..." className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-red-500 dark:text-white resize-none" rows="3"></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCancelModal(false)} disabled={loadingCancel} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors">Retour</button>
                <button type="submit" disabled={loadingCancel || !cancelReason.trim()} className="flex-1 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 flex justify-center items-center gap-2 disabled:opacity-50 transition-all">
                  {loadingCancel ? "Traitement..." : <>Confirmer <FiTrash2 /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOuvertureModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Ouverture de Caisse</h3>
            <p className="text-slate-500 mb-6 text-sm">Déclarez la monnaie en espèces présente dans votre tiroir-caisse ce matin.</p>
            <form onSubmit={handleOuvrirCaisse}>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fond de caisse (Espèces)</label>
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-slate-400 font-bold">€</span></div>
                <input type="number" step="0.01" value={fondDeCaisse} onChange={(e) => setFondDeCaisse(e.target.value)} required className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xl font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder="Ex: 50.00" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowOuvertureModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Annuler</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Ouvrir la caisse</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClotureModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2"><FiArchive /> Clôture de Caisse</h3>
            <p className="text-slate-500 mb-6 text-sm">Fin de journée. Comptez physiquement votre caisse et vos tickets TPE.</p>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl mb-6 space-y-2 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attendu par l'ordinateur</p>
              <div className="flex justify-between font-bold"><span className="text-slate-600 dark:text-slate-300">Espèces (inclut fond)</span><span className="text-slate-900 dark:text-white">{(theoriqueCaisse.especes / 100).toFixed(2)} €</span></div>
              <div className="flex justify-between font-bold"><span className="text-slate-600 dark:text-slate-300">Carte Bancaire (TPE)</span><span className="text-slate-900 dark:text-white">{(theoriqueCaisse.cb / 100).toFixed(2)} €</span></div>
            </div>
            <form onSubmit={handleCloturerCaisse} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Espèces réelles</label>
                  <div className="relative"><input type="number" step="0.01" value={reelEspeces} onChange={(e) => setReelEspeces(e.target.value)} required className="w-full pl-4 pr-8 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder="0.00" /><span className="absolute right-3 top-3 text-slate-400 font-bold">€</span></div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Total CB réel</label>
                  <div className="relative"><input type="number" step="0.01" value={reelCb} onChange={(e) => setReelCb(e.target.value)} required className="w-full pl-4 pr-8 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder="0.00" /><span className="absolute right-3 top-3 text-slate-400 font-bold">€</span></div>
                </div>
              </div>
              {((parseFloat(reelEspeces) * 100 || 0) !== theoriqueCaisse.especes || (parseFloat(reelCb) * 100 || 0) !== theoriqueCaisse.cb) && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mt-4">
                  <p className="text-orange-800 font-bold flex items-center gap-2 mb-2"><FiAlertTriangle /> Un écart a été détecté</p>
                  <textarea value={justification} onChange={(e) => setJustification(e.target.value)} required placeholder="Justifiez cet écart pour la comptabilité..." className="w-full p-3 border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-500 bg-white" rows="2"></textarea>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowClotureModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Annuler</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black">Valider Clôture</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 print:hidden">
          <button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20"><FiX className="text-3xl" /></button>
          <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden border-4 border-indigo-500 shadow-2xl relative aspect-square"><Scanner onScan={handleScan} /></div>
        </div>
      )}
    </div>
  );
}