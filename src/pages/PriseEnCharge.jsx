import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { enregistrerMouvement, paiementDejaEnregistre, getHistoriqueCommande, getTheoriqueCaisse } from "../lib/comptabilite";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QRCodeCanvas } from "qrcode.react";
import { 
  FiSearch, FiCheckCircle, FiCamera, FiX, FiArrowRight, 
  FiList, FiArrowLeft, FiCreditCard, FiDollarSign, FiFileText, FiClock,
  FiTrash2, FiAlertTriangle, FiLock, FiUnlock, FiArchive, FiUser, FiPlus, FiPrinter,
  FiSmartphone, FiRefreshCw, FiCopy, FiExternalLink, FiCheck, FiEyeOff, FiTag
} from "react-icons/fi";
import { logAction } from "../lib/logger";

// ─── Badge moyen de paiement + type mouvement ──────────────────────────────
function MouvementBadge({ tx }) {
  const montant = Number(tx.montant_cents);
  const isNegatif = montant < 0;

  if (isNegatif) {
    return (
      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 w-max">
        <FiTrash2 /> Annulation
      </span>
    );
  }

  switch (tx.type_mouvement) {
    case 'fond_caisse':
      return <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiUnlock /> Fond de Caisse</span>;
    case 'ajout_caisse':
      return <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiPlus /> Ajout Caisse</span>;
    default:
      break;
  }

  switch (tx.moyen_paiement) {
    case 'especes':      return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiDollarSign /> Espèces</span>;
    case 'cb':           return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiCreditCard /> CB</span>;
    case 'stripe_web':   return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiFileText /> Stripe Web</span>;
    case 'stripe_guichet': return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex items-center gap-1 w-max"><FiSmartphone /> Stripe Guichet</span>;
    default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold w-max">{tx.moyen_paiement}</span>;
  }
}

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
  const [tarifs, setTarifs] = useState([]);

  const [montantEncaisse, setMontantEncaisse] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [loadingPaiement, setLoadingPaiement] = useState(false);

  // ── Stripe guichet ─────────────────────────────────────────────────────────
  const [stripeModal, setStripeModal] = useState(null);
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loadingCancel, setLoadingCancel] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creneauxDispo, setCreneauxDispo] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [newResaForm, setNewResaForm] = useState({
    first_name: "", last_name: "", phone: "", email: "",
    sacrifice_name: "", creneau_id: "", tarif_categorie: "", prix_cents: 0
  });
  const [autoFillSacrifice, setAutoFillSacrifice] = useState(true);

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
    const { data } = await supabase
      .from('caisses_vendeurs')
      .select('*')
      .eq('vendeur_email', user.email)
      .eq('statut', 'ouverte')
      .maybeSingle();
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

  // ── Chargement de l'historique comptable d'une commande ───────────────────
  const loadHistorique = async (id) => {
    try {
      const data = await getHistoriqueCommande(id);
      setHistorique(data);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  };

  const selectCommande = (cmd) => {
    setHistorique([]); // On vide l'historique pour éviter les flashs d'anciennes données
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

  // ── Ouverture de caisse ───────────────────────────────────────────────────
  const handleOuvrirCaisse = async (e) => {
    e.preventDefault();
    const fondCents = Math.round((parseFloat(fondDeCaisse) || 0) * 100);
    try {
      const { data, error } = await supabase.from('caisses_vendeurs').insert({
        vendeur_email: userEmail,
        fond_caisse_initial_cents: fondCents,
        statut: 'ouverte'
      }).select().single();
      if (error) throw error;

      // ── Enregistrement du fond de caisse dans la comptabilité ──
      if (fondCents > 0) {
        await enregistrerMouvement({
          type_mouvement:   'fond_caisse',
          montant_cents:    fondCents,
          moyen_paiement:   'especes',
          caisse_id:        data.id,
          notes:            `Fond de caisse déclaré à l'ouverture`,
        });
      }

      setActiveCaisse(data);
      setShowOuvertureModal(false);
      showNotification("Caisse ouverte avec succès.", "success");
      logAction('CREATION', 'CAISSE', { action: 'Ouverture de caisse', fond_initial: fondCents / 100 });
    } catch (err) { showNotification("Erreur lors de l'ouverture de caisse.", "error"); }
  };

  // ── Préparation de la clôture ──────────────────────────────────────────────
  const preparerCloture = async () => {
    try {
      const th = await getTheoriqueCaisse(activeCaisse.id, activeCaisse.fond_caisse_initial_cents || 0);
      setTheoriqueCaisse(th);
      setShowClotureModal(true);
    } catch (err) {
      showNotification("Erreur calcul clôture.", "error");
    }
  };

  const handleCloturerCaisse = async (e) => {
    e.preventDefault();
    const reelEspecesCents = Math.round((parseFloat(reelEspeces) || 0) * 100);
    const reelCbCents      = Math.round((parseFloat(reelCb) || 0) * 100);
    const ecartEspeces     = reelEspecesCents - theoriqueCaisse.especes;
    const ecartCb          = reelCbCents - theoriqueCaisse.cb;

    if ((ecartEspeces !== 0 || ecartCb !== 0) && !justification.trim()) {
      return showNotification("Un écart a été détecté. Une justification est obligatoire.", "error");
    }
    try {
      const { error } = await supabase.from('caisses_vendeurs').update({
        total_theorique_especes_cents: theoriqueCaisse.especes,
        total_theorique_cb_cents:      theoriqueCaisse.cb,
        total_reel_especes_cents:      reelEspecesCents,
        total_reel_cb_cents:           reelCbCents,
        ecart_especes_cents:           ecartEspeces,
        ecart_cb_cents:                ecartCb,
        justification_ecart:           justification,
        statut:                        'cloturee',
        heure_cloture:                 new Date().toISOString()
      }).eq('id', activeCaisse.id);
      if (error) throw error;
      logAction('MODIFICATION', 'CAISSE', {
        action: 'Clôture de caisse',
        ecart_especes: ecartEspeces / 100,
        ecart_cb:      ecartCb / 100,
        justification
      });
      setActiveCaisse(null); setShowClotureModal(false);
      showNotification("Caisse clôturée.", "success"); setCommande(null);
    } catch (err) { showNotification("Erreur lors de la clôture.", "error"); }
  };

  // ── Création réservation guichet ──────────────────────────────────────────
  const openCreateModal = async () => {
    if (!activeCaisse) return showNotification("Ouvrez votre caisse d'abord !", "error");
    setLoading(true);
    try {
      const { data: slots, error: slotsError } = await supabase
        .from("creneaux_horaires").select("*")
        .order("date", { ascending: true }).order("heure_debut", { ascending: true });
      if (slotsError) throw slotsError;

      const { data: stockData } = await supabase
        .from("commandes").select("creneau_id").eq("statut", "disponible");
      const stockMap = {};
      (stockData || []).forEach(t => { stockMap[t.creneau_id] = (stockMap[t.creneau_id] || 0) + 1; });

      setCreneauxDispo((slots || []).map(s => ({ ...s, places_restantes: stockMap[s.id] || 0 })));
      const { data: prix } = await supabase.from("tarifs").select("*").order("prix_cents");
      setTarifs(prix || []);
      setNewResaForm({ first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "", creneau_id: "", tarif_categorie: "", prix_cents: 0 });
      setAutoFillSacrifice(true);
      setShowCreateModal(true);
    } catch (err) { showNotification("Erreur de chargement des données.", "error"); } finally { setLoading(false); }
  };

  const handleNameChange = (field, value) => {
    setNewResaForm(prev => {
      const updated = { ...prev, [field]: value };
      if (autoFillSacrifice) updated.sacrifice_name = `${updated.last_name} ${updated.first_name}`.trim();
      return updated;
    });
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!newResaForm.creneau_id || !newResaForm.tarif_categorie)
      return showNotification("Sélectionnez un créneau et un tarif.", "error");
    setLoadingCreate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc("reserver_prochain_ticket", {
        p_creneau_id:          newResaForm.creneau_id,
        p_client_id:           user.id,
        p_nom:                 newResaForm.last_name,
        p_prenom:              newResaForm.first_name,
        p_email:               newResaForm.email || "surplace@abattoir.local",
        p_tel:                 newResaForm.phone,
        p_sacrifice_name:      newResaForm.sacrifice_name,
        p_categorie:           newResaForm.tarif_categorie,
        p_montant_total_cents: newResaForm.prix_cents,
        p_acompte_cents:       0
      });
      if (error) throw error;

      logAction('CREATION', 'COMMANDE', {
        ticket: data.ticket_num,
        source: 'guichet_sur_place',
        client: `${newResaForm.first_name} ${newResaForm.last_name}`
      });
      showNotification(`Réservation enregistrée ! Ticket N°${data.ticket_num}`, "success");
      setShowCreateModal(false);
      const { data: fullCmd } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", data.commande_id).single();
      if (fullCmd) selectCommande(fullCmd);
    } catch (err) { showNotification("Erreur lors de la création.", "error"); } finally { setLoadingCreate(false); }
  };

  // ── Encaissement standard (espèces / CB) ─────────────────────────────────
  const validerPaiement = async (e) => {
    e.preventDefault();
    if (!activeCaisse) return showNotification("Ouvrez votre caisse !", "error");
    if (modePaiement === 'stripe') return lancerPaiementStripe();

    const montantAsaisi = parseFloat(montantEncaisse) || 0;
    if (montantAsaisi <= 0) return showNotification("Saisissez un montant.", "info");
    setLoadingPaiement(true);
    try {
      const montantAjouteCents = Math.round(montantAsaisi * 100);

      // ── Ligne comptabilité ──
      await enregistrerMouvement({
        type_mouvement:    'encaissement',
        montant_cents:     montantAjouteCents,
        moyen_paiement:    modePaiement,   // 'especes' ou 'cb'
        commande_id:       commande.id,
        ticket_num:        commande.ticket_num,
        caisse_id:         activeCaisse.id,
        notes:             `Encaissement guichet — ${commande.sacrifice_name}`,
      });

      // --- CALCUL DU NOUVEAU TOTAL PAYÉ VIA COMPTABILITÉ ---
      // On additionne l'historique actuel + le mouvement qu'on vient de faire
      const dejaPayeLocalCents = historique.reduce((acc, tx) => acc + Number(tx.montant_cents || 0), 0);
      const nouveauTotalPayeCents = dejaPayeLocalCents + montantAjouteCents;

      let nouveauStatut = commande.statut;
      const tarifActuel = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents  = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);

      if (nouveauTotalPayeCents >= totalCents)                          nouveauStatut = 'paye_integralement';
      else if (nouveauStatut === 'en_attente' && nouveauTotalPayeCents > 0) nouveauStatut = 'acompte_paye';

      await supabase.from('commandes').update({
        montant_paye_cents: nouveauTotalPayeCents,
        statut: nouveauStatut
      }).eq('id', commande.id);

      logAction('CREATION', 'CAISSE', { ticket: commande.ticket_num, montant_encaisse: montantAsaisi, moyen: modePaiement });
      showNotification("Paiement encaissé avec succès.", "success");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if (data) selectCommande(data);
    } catch (err) { showNotification("Erreur d'encaissement : " + err.message, "error"); } finally { setLoadingPaiement(false); }
  };

  // ── Génération lien Stripe guichet ────────────────────────────────────────
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
          panierId:     commande.id,
          description:  `Paiement guichet – Ticket N°${commande.ticket_num} (${commande.sacrifice_name})`,
          email:        commande.contact_email || undefined
        }),
      });
      const data = await response.json();
      if (!data.url) throw new Error(data.error || "Réponse Stripe invalide");
      const sessionId = data.url.split("/pay/")[1]?.split("#")[0] || `guichet_${Date.now()}`;
      setStripeModal({ url: data.url, sessionId, montantCents });
    } catch (err) {
      showNotification("Erreur Stripe : " + err.message, "error");
    } finally { setLoadingPaiement(false); }
  };

  const verifierPaiementStripe = async () => {
    if (!stripeModal) return;
    setCheckingStripe(true);
    try {
      const res = await fetch(`/api/verify-session/${stripeModal.sessionId}`);
      if (!res.ok) { await enregistrerPaiementStripe(); return; }
      const session = await res.json();
      if (session.payment_status === 'paid') await enregistrerPaiementStripe();
      else showNotification("Paiement pas encore effectué par le client.", "info");
    } catch { await enregistrerPaiementStripe(); }
    finally { setCheckingStripe(false); }
  };

  const enregistrerPaiementStripe = async () => {
    if (!stripeModal || !activeCaisse) return;
    try {
      const { montantCents, sessionId } = stripeModal;

      // ── Vérification anti-doublon ──
      const dejaEnregistre = await paiementDejaEnregistre(sessionId);
      if (dejaEnregistre) {
        showNotification("Ce paiement Stripe a déjà été enregistré.", "info");
        setStripeModal(null);
        return;
      }

      // ── Ligne comptabilité ──
      await enregistrerMouvement({
        type_mouvement:    'encaissement',
        montant_cents:     montantCents,
        moyen_paiement:    'stripe_guichet',
        commande_id:       commande.id,
        ticket_num:        commande.ticket_num,
        caisse_id:         activeCaisse.id,
        reference_externe: sessionId,
        notes:             `Lien Stripe généré au guichet — ${commande.sacrifice_name}`,
      });

      // --- CALCUL DU NOUVEAU TOTAL PAYÉ VIA COMPTABILITÉ ---
      const dejaPayeLocalCents = historique.reduce((acc, tx) => acc + Number(tx.montant_cents || 0), 0);
      const nouveauTotalPayeCents = dejaPayeLocalCents + montantCents;
      
      const tarifActuel           = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents            = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);
      const nouveauStatut         = nouveauTotalPayeCents >= totalCents ? 'paye_integralement' : 'acompte_paye';

      await supabase.from('commandes').update({
        montant_paye_cents: nouveauTotalPayeCents,
        statut: nouveauStatut
      }).eq('id', commande.id);

      logAction('CREATION', 'CAISSE', { ticket: commande.ticket_num, montant: montantCents / 100, moyen: 'stripe_guichet' });
      showNotification("Paiement Stripe confirmé et enregistré !", "success");
      setStripeModal(null); setMontantEncaisse("");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if (data) selectCommande(data);
    } catch (err) { showNotification("Erreur enregistrement : " + err.message, "error"); }
  };

  const copierLien = () => {
    if (!stripeModal) return;
    navigator.clipboard.writeText(stripeModal.url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // ── Changement de catégorie ───────────────────────────────────────────────
  const appliquerCategorie = async () => {
    if (!commande) return;
    if (!categorieChoisie) return showNotification("Sélectionnez une catégorie.", "error");
    const tarif = tarifs.find(t => t.categorie === categorieChoisie);
    if (!tarif) return showNotification("Tarif introuvable.", "error");
    setLoadingCategorie(true);
    try {
      const { error } = await supabase.from("commandes")
        .update({ categorie: categorieChoisie, montant_total_cents: tarif.prix_cents })
        .eq("id", commande.id);
      if (error) throw error;
      logAction('MODIFICATION', 'COMMANDE', {
        ticket: commande.ticket_num,
        nouvelle_categorie: categorieChoisie,
        nouveau_montant_total: tarif.prix_cents / 100
      });
      showNotification("Catégorie appliquée.", "success");
      const { data } = await supabase.from("commandes").select("*, creneaux_horaires(*)").eq("id", commande.id).single();
      if (data) selectCommande(data);
    } catch (err) { showNotification("Erreur : " + err.message, "error"); } finally { setLoadingCategorie(false); }
  };

  // ── Annulation d'une transaction ──────────────────────────────────────────
  const promptAnnulerTransaction = (transaction) => {
    if (!activeCaisse) return showNotification("Caisse fermée.", "error");
    // On ne peut pas annuler les paiements Stripe (gérés côté Stripe)
    if (transaction.moyen_paiement === 'stripe_web' || transaction.moyen_paiement === 'stripe_guichet') {
      return showNotification("Impossible d'annuler un paiement Stripe ici. Utilisez le dashboard Stripe.", "error");
    }
    setTransactionToCancel(transaction);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const confirmAnnulerTransaction = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return showNotification("Saisissez un motif.", "info");
    setLoadingCancel(true);
    try {
      // ── Ligne comptabilité négative ──
      await enregistrerMouvement({
        type_mouvement:    'annulation',
        montant_cents:     -Math.abs(transactionToCancel.montant_cents),
        moyen_paiement:    transactionToCancel.moyen_paiement,
        commande_id:       commande.id,
        ticket_num:        commande.ticket_num,
        caisse_id:         activeCaisse.id,
        motif:             cancelReason,
        notes:             `Annulation de la transaction du ${new Date(transactionToCancel.created_at).toLocaleString('fr-FR')}`,
      });

      // --- CALCUL DU NOUVEAU TOTAL PAYÉ VIA COMPTABILITÉ (en soustrayant le montant annulé) ---
      const dejaPayeLocalCents = historique.reduce((acc, tx) => acc + Number(tx.montant_cents || 0), 0);
      const nouveauPayeCents  = Math.max(0, dejaPayeLocalCents - Math.abs(transactionToCancel.montant_cents));

      let nouveauStatut       = commande.statut;
      const tarifActuel       = tarifs.find(t => String(t.categorie) === String(commande.categorie));
      const totalCents        = tarifActuel ? tarifActuel.prix_cents : (commande.montant_total_cents || 0);

      if (nouveauPayeCents < totalCents && commande.statut === 'paye_integralement') {
        nouveauStatut = nouveauPayeCents > 0 ? 'acompte_paye' : 'en_attente';
      }
      await supabase.from('commandes').update({
        montant_paye_cents: nouveauPayeCents,
        statut: nouveauStatut
      }).eq('id', commande.id);

      logAction('SUPPRESSION', 'CAISSE', {
        ticket:          commande.ticket_num,
        montant_annule:  transactionToCancel.montant_cents / 100,
        motif:           cancelReason
      });
      showNotification("Annulation tracée.", "success");
      setShowCancelModal(false); setTransactionToCancel(null);
      loadCommandeById(commande.id);
    } catch (err) { showNotification("Erreur d'annulation : " + err.message, "error"); } finally { setLoadingCancel(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  // --- NOUVEAU SYSTÈME DE CALCUL BASÉ SUR LA TABLE COMPTABILITÉ (State historique) ---
  const tarifActuel      = commande ? tarifs.find(t => String(t.categorie) === String(commande.categorie)) : null;
  const total            = commande ? (tarifActuel?.prix_cents ? tarifActuel.prix_cents / 100 : (commande.montant_total_cents / 100)) : 0;
  
  // Somme de tous les montant_cents de l'historique chargé depuis la table comptabilite
  const dejaPayeCents    = historique.reduce((acc, tx) => acc + Number(tx.montant_cents || 0), 0);
  const dejaPaye         = dejaPayeCents / 100;
  
  const resteAPayer      = Math.max(0, total - dejaPaye);
  // Seuil de tolérance de 5 centimes pour marquer comme payé
  const isPaye           = commande ? (resteAPayer <= 0.05 && total > 0) : false;

  const MODES_PAIEMENT = [
    { key: 'especes',        label: 'Espèces',        icon: <FiDollarSign />,  color: 'emerald' },
    { key: 'cb',             label: 'Carte Bancaire',  icon: <FiCreditCard />,  color: 'blue'    },
    { key: 'stripe',         label: 'Lien Stripe',     icon: <FiSmartphone />,  color: 'purple'  },
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
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Encaissement espèces, CB ou lien Stripe — tout est tracé.</p>
          </div>

          <div>
            {activeCaisse ? (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 p-2 pr-4 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white"><FiUnlock className="text-lg" /></div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase">Caisse Ouverte</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">Depuis {new Date(activeCaisse.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
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

            {/* ── Colonne gauche : recherche ─────────────────────────────── */}
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

            {/* ── Colonne droite : dossier + encaissement ────────────────── */}
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
                      <button onClick={handleBackToList} className="hidden sm:flex px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition-colors"> Client Suivant </button>
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
                            {tarifs.map(t => (<option key={t.categorie} value={t.categorie}>Cat. {t.categorie} ({(t.prix_cents / 100).toFixed(2)} €)</option>))}
                          </select>
                          <button type="button" onClick={appliquerCategorie} disabled={loadingCategorie || !categorieChoisie} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-all">
                            {loadingCategorie ? "Application..." : "Appliquer"}
                          </button>
                        </div>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-700 pt-6 space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Prix Total</span><span className="font-bold dark:text-white">{total.toFixed(2)} €</span></div>
                        <div className="flex justify-between text-sm items-center"><span className="text-slate-500">Total Payé (Comptabilité)</span><span className="font-bold text-emerald-600">- {dejaPaye.toFixed(2)} €</span></div>
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
                                <button key={mode.key} type="button" onClick={() => setModePaiement(mode.key)} className={`py-4 px-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${modePaiement === mode.key ? `border-${mode.color}-500 bg-${mode.color}-50 text-${mode.color}-700 dark:bg-${mode.color}-900/20` : 'border-transparent bg-white dark:bg-slate-800 text-slate-500'}`}>
                                  <div className="text-2xl">{mode.icon}</div>
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{mode.label}</span>
                                </button>
                              ))}
                            </div>

                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">€</span>
                              <input type="number" step="0.01" value={montantEncaisse} onChange={(e) => setMontantEncaisse(e.target.value)} placeholder={resteAPayer.toFixed(2)} className="w-full pl-10 pr-4 py-5 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-2xl font-black outline-none focus:border-indigo-500 transition-all dark:text-white" />
                              <button type="button" onClick={() => setMontantEncaisse(resteAPayer.toFixed(2))} className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-colors">MAX</button>
                            </div>

                            <button type="submit" disabled={loadingPaiement || !montantEncaisse} className="w-full py-5 bg-slate-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50">
                              {loadingPaiement ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}
                              {modePaiement === 'stripe' ? "Générer Lien Stripe" : `Encaisser ${montantEncaisse ? montantEncaisse + ' €' : ''}`}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-10 border-2 border-dashed border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-center">
                           <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-800/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce-slow">
                             <FiCheckCircle className="text-4xl" />
                           </div>
                           <h3 className="text-2xl font-black text-emerald-800 dark:text-emerald-400">Dossier Complet</h3>
                           <p className="text-emerald-600 dark:text-emerald-500 mt-2 font-medium">Le paiement a été intégralement régularisé.</p>
                           <button onClick={handlePrint} className="mt-8 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all">
                             <FiPrinter /> Imprimer le ticket
                           </button>
                        </div>
                      )}

                      {/* Historique des paiements */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm uppercase tracking-widest"><FiClock className="text-indigo-500" /> Historique Transactions</h4>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                          {historique.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm italic">Aucun mouvement enregistré pour ce dossier.</div>
                          ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-700">
                              {historique.map((tx) => (
                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <MouvementBadge tx={tx} />
                                    <div>
                                      <p className="text-sm font-bold text-slate-800 dark:text-white">{(tx.montant_cents / 100).toFixed(2)} €</p>
                                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{new Date(tx.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                  </div>
                                  {tx.montant_cents > 0 && (
                                    <button onClick={() => promptAnnulerTransaction(tx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Annuler cet encaissement">
                                      <FiTrash2 />
                                    </button>
                                  )}
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
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                    <FiFileText className="text-4xl" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500">Sélectionnez une réservation</h3>
                  <p className="text-slate-400 text-sm mt-2">Utilisez la recherche ou le scanner à gauche</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ TICKET CAISSE (INVISIBLE SAUF PRINT) ═══════════ */}
      {commande && (
        <div id="ticket-zebra" style={{ display: 'none' }}>
          <div style={{ borderBottom: '1px dashed black', paddingBottom: '2mm', marginBottom: '2mm' }}>
             <h2 style={{ fontSize: '14pt', fontWeight: '900', margin: '0 0 1mm 0' }}>REÇU DE PAIEMENT</h2>
             <p style={{ fontSize: '9pt', margin: '0' }}>Abattoir — Aïd Al Adha</p>
          </div>
          
          <div style={{ textAlign: 'left', fontSize: '10pt', marginBottom: '3mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ticket: <strong>#{commande.ticket_num}</strong></span>
              <span>Date: {new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div style={{ marginTop: '1mm' }}>
              Client: <strong>{commande.contact_last_name} {commande.contact_first_name}</strong>
            </div>
            <div>Sacrifice: {commande.sacrifice_name}</div>
          </div>

          <div style={{ borderTop: '1px solid black', paddingTop: '2mm', marginBottom: '3mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt' }}>
              <span>Catégorie {commande.categorie}</span>
              <span>{total.toFixed(2)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', color: '#444' }}>
              <span>Déjà réglé (Compta)</span>
              <span>- {dejaPaye.toFixed(2)} €</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: '900', marginTop: '1mm' }}>
              <span>SOLDE</span>
              <span>{resteAPayer.toFixed(2)} €</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <QRCodeCanvas value={JSON.stringify({ id: commande.id, ticket_num: commande.ticket_num })} size={80} />
          </div>
          <p style={{ fontSize: '7pt', marginTop: '2mm' }}>Veuillez conserver ce ticket pour le retrait.</p>
        </div>
      )}

      {/* ═══════════ MODALES ═══════════ */}

      {/* Modale Ouverture Caisse */}
      {showOuvertureModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 text-3xl mx-auto"><FiUnlock /></div>
              <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white">Ouverture de Caisse</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mt-2">Saisissez votre fond de caisse initial pour commencer.</p>
              
              <form onSubmit={handleOuvrirCaisse} className="mt-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Fond de caisse (€)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                    <input type="number" step="0.01" value={fondDeCaisse} onChange={(e) => setFondDeCaisse(e.target.value)} required placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xl font-bold outline-none focus:border-indigo-500 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowOuvertureModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors">Annuler</button>
                  <button type="submit" className="flex-2 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all px-8">Ouvrir la session</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modale Clôture Caisse */}
      {showClotureModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl my-8 animate-zoom-in">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Clôture de Caisse</h2>
                <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-wider">{new Date().toLocaleDateString('fr-FR')}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                  <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-1">Théorique Espèces</p>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-300">{(theoriqueCaisse.especes / 100).toFixed(2)} €</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-[10px] font-black text-blue-800 dark:text-blue-400 uppercase tracking-widest mb-1">Théorique CB</p>
                  <p className="text-2xl font-black text-blue-900 dark:text-blue-300">{(theoriqueCaisse.cb / 100).toFixed(2)} €</p>
                </div>
              </div>

              <form onSubmit={handleCloturerCaisse} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Réel Espèces (€)</label>
                    <input type="number" step="0.01" value={reelEspeces} onChange={(e) => setReelEspeces(e.target.value)} required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Réel CB (€)</label>
                    <input type="number" step="0.01" value={reelCb} onChange={(e) => setReelCb(e.target.value)} required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 dark:text-white" />
                  </div>
                </div>

                {(reelEspeces !== "" || reelCb !== "") && (
                  <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${ (Math.round(parseFloat(reelEspeces || 0)*100) - theoriqueCaisse.especes === 0 && Math.round(parseFloat(reelCb || 0)*100) - theoriqueCaisse.cb === 0) ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                    <div className="flex items-center gap-2">
                      <FiAlertTriangle />
                      <span className="text-sm font-bold">Écart total: {( (Math.round(parseFloat(reelEspeces || 0)*100) + Math.round(parseFloat(reelCb || 0)*100) - (theoriqueCaisse.especes + theoriqueCaisse.cb)) / 100).toFixed(2)} €</span>
                    </div>
                  </div>
                )}

                { (Math.round(parseFloat(reelEspeces || 0)*100) - theoriqueCaisse.especes !== 0 || Math.round(parseFloat(reelCb || 0)*100) - theoriqueCaisse.cb !== 0) && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Justification de l'écart</label>
                    <textarea value={justification} onChange={(e) => setJustification(e.target.value)} required placeholder="Ex: Erreur rendu monnaie, client parti sans payer..." className="w-full p-4 bg-white dark:bg-slate-950 border-2 border-orange-200 dark:border-orange-900/50 rounded-xl text-sm outline-none focus:border-orange-500 dark:text-white" rows="3"></textarea>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button type="button" onClick={() => setShowClotureModal(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" className="flex-2 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all px-8">Confirmer la Clôture</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modale Scanner */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6 animate-fade-in">
          <button onClick={() => setShowScanner(false)} className="absolute top-8 right-8 text-white bg-white/10 p-4 rounded-full hover:bg-white/20 transition-all"><FiX className="text-3xl" /></button>
          <div className="w-full max-w-lg aspect-square rounded-3xl overflow-hidden border-4 border-white/20 relative shadow-2xl">
            <Scanner onScan={handleScan} />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-indigo-400 rounded-2xl animate-pulse"></div>
          </div>
          <h2 className="text-white text-2xl font-black mt-8">Scannez le Ticket</h2>
          <p className="text-indigo-300 mt-2">Placez le QR Code dans le cadre</p>
        </div>
      )}

      {/* Modale Annulation Transaction */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 text-red-600"><FiTrash2 /> Annuler une transaction</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm">Vous êtes sur le point d'annuler un encaissement de <strong>{(transactionToCancel.montant_cents / 100).toFixed(2)} €</strong> ({transactionToCancel.moyen_paiement}).</p>
              
              <form onSubmit={confirmAnnulerTransaction} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Motif de l'annulation</label>
                  <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required placeholder="Ex: Erreur de montant, client a changé d'avis..." className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-red-500 dark:text-white" rows="2"></textarea>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCancelModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Retour</button>
                  <button type="submit" disabled={loadingCancel} className="flex-2 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-700 disabled:opacity-50"> {loadingCancel ? "Traitement..." : "Confirmer l'annulation"} </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modale Stripe (Lien) */}
      {stripeModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl"><FiSmartphone /></div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Paiement Stripe prêt</h2>
              <p className="text-slate-500 mt-2">Faites scanner ce code au client ou envoyez-lui le lien.</p>
              
              <div className="mt-8 flex flex-col items-center gap-6">
                <div className="p-4 bg-white rounded-3xl shadow-inner border border-slate-100">
                  <QRCodeCanvas value={stripeModal.url} size={200} />
                </div>
                
                <div className="w-full space-y-3">
                  <button onClick={copierLien} className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-all active:scale-95">
                    {copiedLink ? <><FiCheck className="text-emerald-500" /> Lien copié !</> : <><FiCopy /> Copier le lien de paiement</>}
                  </button>
                  <button onClick={verifierPaiementStripe} disabled={checkingStripe} className="w-full py-5 bg-purple-600 text-white font-black rounded-2xl shadow-xl shadow-purple-500/30 hover:bg-purple-700 flex items-center justify-center gap-3 transition-all">
                    {checkingStripe ? <FiRefreshCw className="animate-spin" /> : <FiSearch />}
                    Vérifier le statut du paiement
                  </button>
                  <button onClick={() => setStripeModal(null)} className="text-slate-400 text-sm font-bold hover:text-slate-600">Fermer sans enregistrer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}