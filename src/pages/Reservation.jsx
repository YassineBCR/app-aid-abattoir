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
  const [tarifs, setTarifs] = useState([]);
  const [joursConfig, setJoursConfig] = useState([]);

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "" });
  const [selectedTarif, setSelectedTarif] = useState(null); 
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
          const configJours = jours || [];
          setJoursConfig(configJours);
          
          const { data: prix } = await supabase.from("tarifs").select("*").order("prix_cents");
          const configPrix = prix || [];
          setTarifs(configPrix);
          
          if (configPrix.length > 0) {
              setSelectedTarif(configPrix[0]);
          } else {
              setSelectedTarif({ categorie: '1', nom: 'Place Standard', prix_cents: 0, acompte_cents: 5000 });
          }

          const { data: slots } = await supabase.rpc("get_creneaux_public");
          setCreneaux((slots || []).map(s => ({ ...s, places_disponibles: s.places_restantes })));

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
                  const t = configPrix.find(p => p.categorie === item.categorie);
                  const tarifName = t ? t.nom : `Catégorie ${item.categorie}`;
                  let creneauStr = "";
                  if (item.creneaux_horaires?.date) {
                      const j = configJours.find(jd => jd.date_fete === item.creneaux_horaires.date);
                      // 👉 CORRECTION ICI : On ne formate plus de date, on met "Jour Inconnu" si introuvable
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
      } catch (err) { 
          showNotification("Erreur de chargement.", "error"); 
      } finally { 
          setLoading(false); 
      }
    };
    init();
  }, [navigate, showNotification]);

  useEffect(() => {
    if (!expireTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expireTime - now;

      if (distance <= 0) {
        clearInterval(interval);
        handleExpiration();
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expireTime]);

  const handleExpiration = async () => {
      showNotification("Temps écoulé ! Votre panier a été vidé et les places libérées.", "error");
      setPanier([]);
      setExpireTime(null);
      setPanierId(crypto.randomUUID());
      setStep(1);
      await supabase.rpc('nettoyer_paniers_expires');
      const { data: slots } = await supabase.rpc("get_creneaux_public");
      setCreneaux((slots || []).map(s => ({ ...s, places_disponibles: s.places_restantes })));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  
  // 👉 CORRECTION ICI : On ne formate plus la date, on affiche Jour X ou Jour Inconnu
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
          const acompteFinalCents = selectedTarif.acompte_cents || 5000;

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
              p_acompte_cents: acompteFinalCents,
              p_panier_id: panierId
          });

          if (error) throw error;

          const newItem = {
              id: ticketData.id,
              ticket_num: ticketData.ticket_num,
              tarif: selectedTarif.nom,
              sacrifice: form.sacrifice_name,
              creneau: `${getJourLabel(selectedCreneau.date)} à ${selectedCreneau.heure_debut.slice(0,5)}`,
              acompte: acompteFinalCents
          };

          setPanier(prev => [...prev, newItem]);

          if (!expireTime && ticketData.expire_le) {
              setExpireTime(new Date(ticketData.expire_le).getTime());
          }

          showNotification(`Place ajoutée au panier ! Plus que 1 minutes pour valider.`, "success");
          
          setForm({ ...form, sacrifice_name: "" });
          setSelectedCreneau(null);
          setStep(1);

          setCreneaux(creneaux.map(c => c.id === selectedCreneau.id ? { ...c, places_disponibles: c.places_disponibles - 1 } : c));
      } catch (err) {
          showNotification(err.message, "error");
      } finally {
          setAddingToCart(false);
      }
  };

  const retirerDuPanier = async (itemId) => {
      try {
          await supabase
              .from('commandes')
              .update({
                  statut: 'disponible', client_id: null, contact_first_name: null, contact_last_name: null,
                  contact_phone: null, contact_email: null, sacrifice_name: null, categorie: null,
                  montant_total_cents: 0, acompte_cents: 0, montant_paye_cents: 0, panier_id: null, expire_le: null, numero_boucle: null
              })
              .eq('id', itemId);

          const newPanier = panier.filter(i => i.id !== itemId);
          setPanier(newPanier);

          if (newPanier.length === 0) {
              setExpireTime(null);
              setPanierId(crypto.randomUUID());
          }

          const { data: slots } = await supabase.rpc("get_creneaux_public");
          setCreneaux((slots || []).map(s => ({ ...s, places_disponibles: s.places_restantes })));

          showNotification("Place retirée du panier", "info");
      } catch(err) {
          showNotification("Erreur lors du retrait", "error");
      }
  };

  const validerPanierEtPayer = async () => {
      if (panier.length === 0) return;
      setPaying(true);
      try {
          const totalAcompteCents = panier.reduce((sum, item) => sum + item.acompte, 0);

          const response = await fetch("http://localhost:3000/create-checkout-session", {
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

          if (stripeData.url) {
              window.location.href = stripeData.url; 
          } else {
              throw new Error("Erreur serveur Stripe");
          }
      } catch (err) {
          showNotification("Erreur de connexion : " + err.message, "error");
          setPaying(false);
      }
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
                
                {/* COLONNE GAUCHE : FORMULAIRE */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10 min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><FiLoader className="w-8 h-8 animate-spin text-green-500" /></div>
                    ) : (
                        <>
                            {step === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><span className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span> Vos Coordonnées</h2>
                                    <p className="text-slate-500 text-sm">Veuillez indiquer pour qui est cette réservation (vous pourrez en ajouter d'autres après).</p>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Prénom de l'acheteur" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
                                        <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Nom de l'acheteur" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
                                        <div className="relative"><FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Téléphone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                                        <div className="relative"><FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field opacity-60 cursor-not-allowed" placeholder="Email" value={form.email} disabled /></div>
                                        <div className="relative sm:col-span-2"><FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field border-green-300 dark:border-green-700/50 bg-green-50/30 dark:bg-green-900/10" placeholder="Nom pour le sacrifice (ex: Famille X...)" value={form.sacrifice_name} onChange={e => setForm({...form, sacrifice_name: e.target.value})} /></div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-8 animate-fade-in">
                                    <div>
                                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span> Créneau de retrait</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {creneaux.map((c) => {
                                                const isFull = c.places_disponibles <= 0;
                                                return (
                                                    <button key={c.id} onClick={() => !isFull && setSelectedCreneau(c)} disabled={isFull} className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${selectedCreneau?.id === c.id ? 'bg-blue-500 border-blue-500 text-white transform scale-105 shadow-md' : isFull ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border-slate-200 hover:border-blue-300'}`}>
                                                        <div className="font-bold">{getJourLabel(c.date)} - {c.heure_debut.slice(0,5)}</div>
                                                        <div className="text-xs uppercase">{isFull ? "Complet" : `${c.places_disponibles} places`}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <h2 className="text-2xl font-bold">Vérification de la place</h2>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                                            <div>
                                                <p className="font-bold text-lg">Place Réservée</p>
                                                <p className="text-sm text-slate-500">Pour le sacrifice de : <span className="font-bold text-slate-800 dark:text-white">{form.sacrifice_name}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                                            <div><p className="font-bold text-slate-700 dark:text-slate-200">Retrait le {selectedCreneau ? getJourLabel(selectedCreneau.date) : ""}</p><p className="text-sm text-slate-500">Heure prévue : {selectedCreneau?.heure_debut.slice(0,5)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">Acompte lié à cette place :</span>
                                            <span className="text-2xl font-black text-green-600">
                                                {((selectedTarif?.acompte_cents || 5000) / 100).toFixed(2)} €
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={ajouterAuPanier} disabled={addingToCart || !canAddToCart} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] shadow-xl transition-all">
                                        {addingToCart ? <FiLoader className="animate-spin text-xl" /> : <FiPlus className="text-xl" />}
                                        {addingToCart ? "Ajout en cours..." : "Ajouter cette place au panier"}
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
                                {step > 1 ? <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"><FiArrowLeft /> Retour</button> : <div></div>}
                                {step < 3 && <button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-all">Suivant <FiArrowRight /></button>}
                            </div>
                        </>
                    )}
                </div>

                {/* COLONNE DROITE : LE PANIER VISUEL */}
                <div className={`lg:col-span-1 transition-all duration-500 ${panier.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none hidden lg:block'}`}>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-4 border-green-500 dark:border-green-600 overflow-hidden sticky top-32 flex flex-col max-h-[80vh]">
                        
                        <div className="bg-green-500 p-4 text-white flex justify-between items-center shrink-0 shadow-md">
                            <h3 className="font-black text-xl flex items-center gap-2"><FiShoppingCart /> Votre Panier</h3>
                            <div className="bg-red-500 text-white px-3 py-1 rounded-lg font-mono font-bold text-lg flex items-center gap-2 shadow-inner border border-red-400">
                                <FiClock /> {timeLeft}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                            {panier.length === 0 ? (
                                <p className="text-center text-slate-400 font-medium py-8">Votre panier est vide.</p>
                            ) : (
                                panier.map((item, index) => (
                                    <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                        <div className="absolute -top-3 -left-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-800 z-10">{index + 1}</div>
                                        
                                        <button onClick={() => retirerDuPanier(item.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-2 rounded-lg transition-colors z-10">
                                            <FiTrash2 />
                                        </button>

                                        <div className="flex items-center justify-between pl-3 pr-8 mb-2">
                                            <p className="font-bold text-slate-800 dark:text-white">Place Réservée</p>
                                            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-black border border-indigo-200 dark:border-indigo-800 shadow-sm">
                                                Ticket #{item.ticket_num}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-500 mt-1 pl-3 font-medium">Pour : <span className="text-slate-700 dark:text-slate-300">{item.sacrifice}</span></p>
                                        <p className="text-xs text-slate-500 mt-1 pl-3 mb-3">{item.creneau}</p>
                                        
                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center pl-3">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Acompte:</span>
                                            <span className="font-black text-green-600">{(item.acompte / 100).toFixed(2)} €</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {panier.length > 0 && (
                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)]">
                                
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/50 mb-4">
                                    <p className="text-xs font-bold text-green-800 dark:text-green-400 mb-1 flex items-center gap-1.5">
                                        <FiTag /> Numéros réservés pour vous :
                                    </p>
                                    <p className="text-sm font-black text-green-600 dark:text-green-500">
                                        {panier.map(p => `#${p.ticket_num}`).join(', ')}
                                    </p>
                                </div>

                                <div className="flex justify-between items-end mb-4">
                                    <span className="font-bold text-slate-500">Total à payer :</span>
                                    <span className="text-3xl font-black text-green-600">{(panier.reduce((sum, item) => sum + item.acompte, 0) / 100).toFixed(2)} €</span>
                                </div>
                                <button onClick={validerPanierEtPayer} disabled={paying} className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all">
                                    {paying ? <FiLoader className="animate-spin" /> : <FiCreditCard />} 
                                    Payer {panier.length} place(s)
                                </button>
                                <p className="text-[10px] text-center text-slate-400 font-medium mt-3 flex items-center justify-center gap-1"><FiAlertCircle/> Le paiement valide l'intégralité du panier.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
      </main>
    </div>
  );
}