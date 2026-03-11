import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../contexts/DarkModeContext";
import { useNotification } from "../contexts/NotificationContext"; 
import { supabase } from "../lib/supabase"; 
import { 
  FiSun, FiMoon, FiCheck, FiUser, FiChevronDown, FiGrid, FiLogOut, 
  FiClock, FiArrowRight, FiArrowLeft, FiPhone, FiMail, FiCreditCard, FiLoader, FiMapPin
} from "react-icons/fi";
import { FaMosque } from "react-icons/fa6";

const ACOMPTE_CENTS = 5000;

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
  const [paying, setPaying] = useState(false);

  const [creneaux, setCreneaux] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [joursConfig, setJoursConfig] = useState([]);

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", sacrifice_name: "" });
  const [selectedTarif, setSelectedTarif] = useState(null); 
  const [selectedCreneau, setSelectedCreneau] = useState(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setCurrentUser(user);
      setForm(prev => ({ ...prev, email: user.email }));
      
      try {
          const { data: jours } = await supabase.from("jours_fete").select("*");
          setJoursConfig(jours || []);
          const { data: slots } = await supabase.rpc("get_creneaux_public");
          setCreneaux((slots || []).map(s => ({ ...s, places_disponibles: s.places_restantes })));
          const { data: prix } = await supabase.from("tarifs").select("*").order("prix_cents");
          setTarifs(prix || []);
      } catch (err) { showNotification("Erreur de chargement.", "error"); } finally { setLoading(false); }
    };
    init();
  }, [navigate, showNotification]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  const getJourLabel = (dateStr) => { const j = joursConfig.find(jd => jd.date_fete === dateStr); return j ? `Jour ${j.numero}` : new Date(dateStr).toLocaleDateString('fr-FR'); };

  const handleNext = () => {
    if (step === 1) {
        if (!form.first_name || !form.last_name || !form.phone || !form.sacrifice_name) return showNotification("Veuillez remplir tous les champs.", "error");
        setStep(2);
    } else if (step === 2) {
        if (!selectedTarif || !selectedCreneau) return showNotification("Veuillez choisir une catégorie et un créneau.", "error");
        setStep(3);
    }
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const canSubmit = useMemo(() => {
    return (currentUser && selectedCreneau && selectedTarif && Number(selectedCreneau.places_disponibles) > 0 && form.first_name && form.last_name && form.phone && form.email && form.sacrifice_name && !paying);
  }, [currentUser, selectedCreneau, selectedTarif, form, paying]);

  const reserverEtPayer = async () => {
    if (!canSubmit) return;
    setPaying(true);
    try {
      // ON N'APPELLE PAS LA BASE DE DONNÉES ! ON NE TOUCHE PAS AU STOCK.
      // On envoie juste les infos au serveur pour créer le lien Stripe
      const response = await fetch("http://localhost:3000/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            p_creneau_id: selectedCreneau.id,
            p_client_id: currentUser.id,
            p_nom: form.last_name,
            p_prenom: form.first_name,
            p_email: form.email,
            p_tel: form.phone,
            p_sacrifice_name: form.sacrifice_name,
            p_categorie: selectedTarif.categorie,
            p_montant_total_cents: selectedTarif.prix_cents,
            p_acompte_cents: ACOMPTE_CENTS
          }
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url; // On va sur Stripe
      } else {
        throw new Error("Erreur serveur Stripe");
      }
    } catch (e) {
      showNotification("Erreur de connexion : " + e.message, "error");
    } finally { 
      setPaying(false); 
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${darkMode ? 'dark bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
      <style>{customStyles}</style>
      <BlobBackground />
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 px-6 py-4 ${scrolled ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="text-2xl font-black tracking-tighter flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-gradient-to-tr from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-xs">G</div>
                <span>GRAMMONT</span>
            </div>
            <div className="flex items-center gap-4">
               {currentUser && (
                   <div className="relative" ref={menuRef}>
                       <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all">
                           <FiUser className="text-slate-500 dark:text-slate-400" />
                           <span className="text-sm font-bold max-w-[80px] truncate">{currentUser.email?.split('@')[0]}</span>
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

      <main className="pt-32 pb-20 px-4 md:px-6">
        <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-10"><h1 className="text-3xl md:text-5xl font-black mb-2">Réservation</h1></div>
            
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10 min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><FiLoader className="w-8 h-8 animate-spin text-green-500" /></div>
                ) : (
                    <>
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold">Vos Coordonnées</h2>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Prénom" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
                                    <div className="relative"><FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Nom" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
                                    <div className="relative"><FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Téléphone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                                    <div className="relative"><FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field opacity-60 cursor-not-allowed" placeholder="Email" value={form.email} disabled /></div>
                                    <div className="relative sm:col-span-2"><FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input className="input-field" placeholder="Nom pour le sacrifice (ex: Famille X...)" value={form.sacrifice_name} onChange={e => setForm({...form, sacrifice_name: e.target.value})} /></div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><div className="p-2 bg-green-100 text-green-600 rounded-lg"><FaMosque /></div>1. Type de sacrifice</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {tarifs.map((t) => (
                                            <div key={t.categorie} onClick={() => setSelectedTarif(t)} className={`cursor-pointer p-5 rounded-2xl border-2 ${selectedTarif?.categorie === t.categorie ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-100 dark:border-slate-700'}`}>
                                                <h4 className="font-bold">{t.nom}</h4>
                                                <div className="mt-4 text-right font-black text-green-600">{(t.prix_cents / 100).toFixed(0)} €</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FiClock /></div>2. Créneau de retrait</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {creneaux.map((c) => {
                                            const isFull = c.places_disponibles <= 0;
                                            return (
                                                <button key={c.id} onClick={() => !isFull && setSelectedCreneau(c)} disabled={isFull} className={`p-3 rounded-xl border-2 text-left ${selectedCreneau?.id === c.id ? 'bg-blue-500 border-blue-500 text-white' : isFull ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200'}`}>
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
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold">Récapitulatif</h2>
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700"><div><p className="font-bold text-lg">{selectedTarif?.nom}</p><p className="text-sm">Pour : {form.sacrifice_name}</p></div><div className="text-right"><p className="text-xl font-bold">{(selectedTarif?.prix_cents / 100).toFixed(0)} €</p></div></div>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700"><div><p className="font-bold">{selectedCreneau ? getJourLabel(selectedCreneau.date) : ""}</p><p className="text-sm">{selectedCreneau?.heure_debut.slice(0,5)}</p></div></div>
                                    <div className="flex justify-between items-center pt-2"><span className="font-bold">Acompte à régler</span><span className="text-2xl font-black text-green-600">{(ACOMPTE_CENTS / 100).toFixed(2)} €</span></div>
                                </div>
                                <button onClick={reserverEtPayer} disabled={paying || !canSubmit} className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-[1.02] transition-all">
                                    {paying ? <FiLoader className="animate-spin text-xl" /> : <FiCreditCard className="text-xl" />}{paying ? "Préparation du paiement..." : `Aller au paiement sécurisé`}
                                </button>
                                <p className="text-xs text-center text-slate-400 mt-2 font-bold">
                                  Votre ticket sera généré et la place retirée du stock UNIQUEMENT après paiement.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100 dark:border-slate-700">
                            {step > 1 ? <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold"><FiArrowLeft /> Retour</button> : <div></div>}
                            {step < 3 && <button onClick={handleNext} className="flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold">Suivant <FiArrowRight /></button>}
                        </div>
                    </>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}