import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext"; 
import { supabase } from "../lib/supabase"; 
import { 
  FiSun, FiMoon, FiUser, FiChevronDown, FiGrid, FiLogOut, 
  FiClock, FiArrowRight, FiArrowLeft, FiPhone, FiMail, FiCreditCard, 
  FiLoader, FiMapPin, FiShoppingCart, FiPlus, FiTrash2, FiAlertCircle, FiTag
} from "react-icons/fi";

const customStyles = `
  @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
  .animate-blob { animation: blob 7s infinite; }
  ::-webkit-scrollbar { display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
  .input-field { width: 100%; padding: 12px 12px 12px 40px; border-radius: 12px; outline: none; transition: all 0.2s; border-width: 2px; }
  .input-field { background-color: #f8fafc; border-color: #e2e8f0; color: #1e293b; }
  .input-field:focus { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); background-color: #ffffff; }
  .dark .input-field { background-color: #0f172a; border-color: #334155; color: #f1f5f9; }
  .dark .input-field:focus { border-color: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.2); }
`;

const BlobBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
    <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
  </div>
);

const TARIFS_DURS = [
  { categorie: 'A', nom: 'Catégorie A', prix_cents: 36000, acompte_cents: 10000 },
  { categorie: 'B', nom: 'Catégorie B', prix_cents: 38000, acompte_cents: 10000 },
  { categorie: 'C', nom: 'Catégorie C', prix_cents: 40000, acompte_cents: 10000 }
];

export default function Reservation() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { showNotification } = useNotification();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [paying, setPaying] = useState(false);

  const [creneaux, setCreneaux] = useState([]);
  const [joursConfig, setJoursConfig] = useState([]);

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "" });
  const [selectedTarif, setSelectedTarif] = useState(TARIFS_DURS[0]);
  const [selectedCreneau, setSelectedCreneau] = useState(null);

  const [panierId, setPanierId] = useState(() => crypto.randomUUID());
  const [panier, setPanier] = useState([]);
  const [expireTime, setExpireTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState("1:00");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setCurrentUser(user);
      setForm(prev => ({ ...prev, email: user.email }));
      
      try {
          await supabase.rpc('nettoyer_paniers_expires');
          const { data: jours } = await supabase.from("jours_fete").select("*");
          setJoursConfig(jours || []);
          const { data: slots } = await supabase.rpc("get_creneaux_public");
          const filteredSlots = (slots || []).filter(s => s.is_online !== false);
          setCreneaux(filteredSlots.map(s => ({ ...s, places_disponibles: s.places_restantes })));

          const { data: activeCartItems } = await supabase
            .from("commandes")
            .select(`*, creneaux_horaires(date, heure_debut)`)
            .eq("client_id", user.id)
            .eq("statut", "en_attente")
            .gt("expire_le", new Date().toISOString()); 

          if (activeCartItems && activeCartItems.length > 0) {
              const firstItem = activeCartItems[0];
              setPanierId(firstItem.panier_id || crypto.randomUUID());
              setExpireTime(new Date(firstItem.expire_le).getTime());
              setForm(prev => ({
                  ...prev,
                  first_name: firstItem.contact_first_name || prev.first_name,
                  last_name: firstItem.contact_last_name || prev.last_name,
                  phone: firstItem.contact_phone || prev.phone,
              }));

              const restoredCart = activeCartItems.map(item => {
                  const t = TARIFS_DURS.find(p => p.categorie === item.categorie);
                  const tarifName = t ? t.nom : `Catégorie ${item.categorie}`;
                  let creneauStr = "";
                  if (item.creneaux_horaires?.date) {
                      const j = (jours || []).find(jd => jd.date_fete === item.creneaux_horaires.date);
                      const jourLabel = j ? `Jour ${j.numero}` : 'Jour Inconnu';
                      creneauStr = `${jourLabel} à ${item.creneaux_horaires.heure_debut.slice(0,5)}`;
                  }
                  return {
                      id: item.id,
                      ticket_num: item.ticket_num, 
                      tarif: tarifName,
                      sacrifice: item.sacrifice_name,
                      creneau: creneauStr,
                      acompte: item.acompte_cents
                  };
              });
              setPanier(restoredCart);
          }
      } catch (err) { showNotification("Erreur de chargement.", "error"); } 
      finally { setLoading(false); }
    };
    init();
  }, [navigate, showNotification]);

  const groupedCreneaux = useMemo(() => {
    const groups = {};
    creneaux.forEach(slot => {
        const j = joursConfig.find(jd => jd.date_fete === slot.date);
        const label = j ? `JOUR ${j.numero}` : 'JOUR INCONNU';
        if (!groups[label]) groups[label] = { label, date: slot.date, slots: [] };
        groups[label].slots.push(slot);
    });
    return Object.values(groups).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [creneaux, joursConfig]);

  useEffect(() => {
    if (!expireTime) return;
    const interval = setInterval(() => {
      const distance = expireTime - new Date().getTime();
      if (distance <= 0) { clearInterval(interval); handleExpiration(); } 
      else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expireTime]);

  const handleExpiration = async () => {
      showNotification("Temps écoulé ! Votre panier a été vidé.", "error");
      setPanier([]); setExpireTime(null); setPanierId(crypto.randomUUID()); setStep(1);
      await supabase.rpc('nettoyer_paniers_expires');
      const { data: slots } = await supabase.rpc("get_creneaux_public");
      setCreneaux((slots || []).filter(s => s.is_online !== false).map(s => ({ ...s, places_disponibles: s.places_restantes })));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  
  const getJourLabel = (dateStr) => { 
      const j = joursConfig.find(jd => jd.date_fete === dateStr); 
      return j ? `Jour ${j.numero}` : 'Jour Inconnu'; 
  };

  const handleNext = () => {
    if (step === 1) {
        if (!form.first_name || !form.last_name || !form.phone || !form.sacrifice_name) return showNotification("Veuillez remplir tous les champs.", "error");
        setStep(2);
    } else if (step === 2) {
        if (!selectedCreneau) return showNotification("Veuillez choisir un créneau.", "error");
        setStep(3);
    }
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const canAddToCart = useMemo(() => {
    return (currentUser && selectedCreneau && selectedTarif && Number(selectedCreneau.places_disponibles) > 0 && form.first_name && form.last_name && form.phone && form.email && form.sacrifice_name && !addingToCart);
  }, [currentUser, selectedCreneau, selectedTarif, form, addingToCart]);

  const ajouterAuPanier = async () => {
      if (!canAddToCart) return;
      setAddingToCart(true);
      try {
          const { data: ticketData, error } = await supabase.rpc("reserver_ticket_panier", {
              p_creneau_id: selectedCreneau.id,
              p_client_id: currentUser.id,
              p_nom: form.last_name,
              p_prenom: form.first_name,
              p_email: form.email,
              p_tel: form.phone,
              p_sacrifice_name: form.sacrifice_name,
              p_categorie: selectedTarif.categorie,
              p_montant_total_cents: selectedTarif.prix_cents,
              p_acompte_cents: selectedTarif.acompte_cents,
              p_panier_id: panierId
          });

          if (error) throw error;

          setPanier(prev => [...prev, {
              id: ticketData.id, ticket_num: ticketData.ticket_num, tarif: selectedTarif.nom,
              sacrifice: form.sacrifice_name, creneau: `${getJourLabel(selectedCreneau.date)} à ${selectedCreneau.heure_debut.slice(0,5)}`, acompte: selectedTarif.acompte_cents
          }]);

          if (!expireTime && ticketData.expire_le) setExpireTime(new Date(ticketData.expire_le).getTime());

          showNotification(`Place ajoutée au panier !`, "success");
          setForm({ ...form, sacrifice_name: "" }); setSelectedCreneau(null); setStep(1);
          setCreneaux(creneaux.map(c => c.id === selectedCreneau.id ? { ...c, places_disponibles: c.places_disponibles - 1 } : c));
      } catch (err) { showNotification(err.message, "error"); } finally { setAddingToCart(false); }
  };

  const retirerDuPanier = async (itemId) => {
      try {
          await supabase.from('commandes').update({
              statut: 'disponible', client_id: null, contact_first_name: null, contact_last_name: null,
              contact_phone: null, contact_email: null, sacrifice_name: null, categorie: null,
              montant_total_cents: 0, acompte_cents: 0, montant_paye_cents: 0, panier_id: null, expire_le: null, numero_boucle: null
          }).eq('id', itemId);

          const newPanier = panier.filter(i => i.id !== itemId);
          setPanier(newPanier);
          if (newPanier.length === 0) { setExpireTime(null); setPanierId(crypto.randomUUID()); }

          const { data: slots } = await supabase.rpc("get_creneaux_public");
          setCreneaux((slots || []).filter(s => s.is_online !== false).map(s => ({ ...s, places_disponibles: s.places_restantes })));
      } catch(err) { showNotification("Erreur lors du retrait", "error"); }
  };

  const validerPanierEtPayer = async () => {
      if (panier.length === 0) return;
      setPaying(true);
      try {
          const totalAcompteCents = panier.reduce((sum, item) => sum + item.acompte, 0);
          
          // API VERCEL (Chemin Relatif)
          const response = await fetch("/api/create-checkout-session", {
              method: "POST", 
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                montantTotal: totalAcompteCents, 
                panierId: panierId, 
                description: `Réservation de ${panier.length} place(s)`, 
                email: form.email 
              }),
          });
          const stripeData = await response.json();
          if (stripeData.url) window.location.href = stripeData.url; 
          else throw new Error("Erreur serveur Stripe");
      } catch (err) { showNotification("Erreur de connexion : " + err.message, "error"); setPaying(false); }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 pb-32 md:pb-20 ${darkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
      <style>{customStyles}</style>
      <BlobBackground />
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 px-6 py-4 ${scrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="text-2xl font-black tracking-tighter flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-gradient-to-tr from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-xs">G</div>
                <span>GRAMMONT</span>
            </div>
            <div className="flex items-center gap-4">
               {currentUser && (
                   <div className="relative" ref={menuRef}>
                       <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all">
                           <FiUser className="text-slate-500 dark:text-slate-400" />
                           <span className="hidden md:inline text-sm font-bold truncate">{currentUser.email?.split('@')[0]}</span>
                           <FiChevronDown />
                       </button>
                       {isMenuOpen && (
                           <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                               <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"><FiGrid /> Dashboard</button>
                               <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left border-t border-slate-100 dark:border-slate-700"><FiLogOut /> Déconnexion</button>
                           </div>
                       )}
                   </div>
               )}
               <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">{darkMode ? <FiSun /> : <FiMoon />}</button>
            </div>
        </div>
      </nav>

      <main className="pt-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10"><h1 className="text-3xl md:text-5xl font-black mb-2">Réservation</h1></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10 min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><FiLoader className="w-8 h-8 animate-spin text-green-500" /></div>
                    ) : (
                        <>
                            {step === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><span className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span> Vos Coordonnées</h2>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Prénom" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
                                        <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Nom" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
                                        <div className="relative"><FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Téléphone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                                        <div className="relative"><FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field opacity-60 cursor-not-allowed" placeholder="Email" value={form.email} disabled /></div>
                                        <div className="relative sm:col-span-2"><FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field border-green-300 dark:border-green-700/50 bg-green-50/30 dark:bg-green-900/10" placeholder="Nom pour le sacrifice (ex: Famille X...)" value={form.sacrifice_name} onChange={e => setForm({...form, sacrifice_name: e.target.value})} /></div>
                                    </div>
                                    
                                    <div className="mt-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 text-amber-900 dark:text-amber-200">
                                        <h3 className="text-lg font-black mb-4 flex items-center gap-2"><FiAlertCircle /> Informations importantes</h3>
                                        <div className="space-y-4 text-sm">
                                            <div>
                                                <p className="font-bold">En cas de retard ?</p>
                                                <p>Les horaires de passage sont donnés à titre indicatif et nous ne pouvons nous tenir responsables en cas de retard lors du sacrifice.</p>
                                            </div>
                                            <div>
                                                <p className="font-bold">En cas d'absence ?</p>
                                                <p>En cas d'absence lors du sacrifice, il devra être effectué en votre absence et nous ne pouvons nous tenir responsables.</p>
                                            </div>
                                            <div>
                                                <p className="font-bold">En cas de saisie ?</p>
                                                <p>En cas de saisies par les services vétérinaires :</p>
                                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                                    <li>Lors d'une saisie partielle (cœur, foie, abats, etc...) : Aucun remboursement ni dédommagement ne pourra être demandé.</li>
                                                    <li>En cas de saisie totale : Un remplacement à l'identique sera proposé, aucun remboursement ne pourra être demandé.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="font-bold">En cas d'annulation ?</p>
                                                <p>Aucun remboursement ne pourra être effectué.</p>
                                            </div>
                                            <div>
                                                <p className="font-bold">Après le bouclage de l'agneau ?</p>
                                                <p>Aucun échange ou modification ne pourra être effectué.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
                                        <button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all">
                                            {panier.length === 0 ? "Suivant" : "Ajoutez une place supplémentaire"} <FiArrowRight />
                                        </button>
                                    </div>
                                </div>
                            )}
                            {step === 2 && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                                        <h3 className="text-2xl font-bold flex items-center gap-2"><span className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span> Créneau de passage (à titre indicatif)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {groupedCreneaux.map((group) => (
                                            <div key={group.label} className="space-y-4">
                                                <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-4 rounded-2xl text-center shadow-md">
                                                    <h4 className="text-xl font-black uppercase tracking-wider">{group.label}</h4>
                                                    <p className="text-xs font-medium opacity-90 mt-1">{new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {group.slots.map((c) => {
                                                        const isFull = c.places_disponibles <= 0;
                                                        const isSelected = selectedCreneau?.id === c.id;
                                                        return (
                                                            <button key={c.id} onClick={() => !isFull && setSelectedCreneau(c)} disabled={isFull} className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md ring-2 ring-blue-500/20 translate-x-1' : isFull ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed grayscale' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50'}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex items-center gap-3">
                                                                        <FiClock className={`text-2xl ${isSelected ? 'text-blue-500' : isFull ? 'text-slate-400' : 'text-emerald-500'}`} />
                                                                        <div>
                                                                            <div className="font-black text-xl leading-tight">{c.heure_debut.slice(0,5)}</div>
                                                                            <div className="text-xs text-slate-500">à {c.heure_fin.slice(0,5)}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        {isFull ? <span className="bg-red-500 text-white px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Complet</span> : <div className={`text-sm font-black ${isSelected ? 'text-blue-600' : 'text-emerald-600'}`}>Disponible</div>}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
                                        <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"><FiArrowLeft /> Retour</button>
                                        <button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all">Suivant <FiArrowRight /></button>
                                    </div>
                                </div>
                            )}
                            {step === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-2xl font-bold">Vérification de la place</h2>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                                            <div>
                                                <p className="font-bold text-lg">Place Réservée (Base {selectedTarif.nom})</p>
                                                <p className="text-sm text-slate-500">Pour : <span className="font-bold text-slate-800 dark:text-white">{form.sacrifice_name}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                                            <div><p className="font-bold text-slate-700 dark:text-slate-200">Retrait le {selectedCreneau ? getJourLabel(selectedCreneau.date) : ""}</p><p className="text-sm text-slate-500">Heure : {selectedCreneau?.heure_debut.slice(0,5)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">Acompte à payer :</span>
                                            <span className="text-2xl font-black text-green-600">{(selectedTarif.acompte_cents / 100).toFixed(2)} €</span>
                                        </div>
                                    </div>
                                    <button onClick={ajouterAuPanier} disabled={addingToCart || !canAddToCart} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] shadow-xl transition-all">
                                        {addingToCart ? <FiLoader className="animate-spin" /> : <FiPlus />}
                                        {addingToCart ? "Ajout..." : "Ajouter au panier"}
                                    </button>
                                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
                                        <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"><FiArrowLeft /> Retour</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className={`lg:col-span-1 transition-all duration-500 ${panier.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none hidden lg:block'}`}>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-4 border-green-500 dark:border-green-600 overflow-hidden sticky top-32 flex flex-col max-h-[80vh]">
                        <div className="bg-green-500 p-4 text-white flex justify-between items-center shrink-0 shadow-md">
                            <h3 className="font-black text-xl flex items-center gap-2"><FiShoppingCart /> Panier</h3>
                            <div className="bg-red-500 text-white px-3 py-1 rounded-lg font-mono font-bold text-lg flex items-center gap-2 shadow-inner border border-red-400"><FiClock /> {timeLeft}</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                            {panier.map((item, index) => (
                                <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 z-10">{index + 1}</div>
                                    <button onClick={() => retirerDuPanier(item.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 p-2 rounded-lg transition-colors z-10"><FiTrash2 /></button>
                                    <div className="flex items-center justify-between pl-3 pr-8 mb-2">
                                        <p className="font-bold text-slate-800 dark:text-white">Place #{item.ticket_num}</p>
                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-black border border-indigo-200 shadow-sm">Grammont</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 pl-3 font-medium">Pour : {item.sacrifice}</p>
                                    <p className="text-xs text-slate-500 mt-1 pl-3 mb-3">{item.creneau}</p>
                                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center pl-3">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Acompte:</span>
                                        <span className="font-black text-green-600">{(item.acompte / 100).toFixed(2)} €</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 shrink-0">
                            <div className="flex justify-between items-end mb-4">
                                <span className="font-bold text-slate-500">Total :</span>
                                <span className="text-3xl font-black text-green-600">{(panier.reduce((sum, item) => sum + item.acompte, 0) / 100).toFixed(2)} €</span>
                            </div>
                            <button onClick={validerPanierEtPayer} disabled={paying} className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all">
                                {paying ? <FiLoader className="animate-spin" /> : <FiCreditCard />} Payer {panier.length} place(s)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}