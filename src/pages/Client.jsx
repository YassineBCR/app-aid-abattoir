import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../contexts/DarkModeContext";
import { 
  FiCalendar, FiClock, FiUser, FiMail, FiPhone, FiMapPin, 
  FiCheck, FiCreditCard, FiLoader 
} from "react-icons/fi";

const ACOMPTE_CENTS = 5000; // Acompte fixé à 50€ (exemple, tu peux remettre 100€)
const RESERVE_TIMEOUT_MIN = 15;

export default function Client() {
  const { darkMode } = useDarkMode();
  const [user, setUser] = useState(null);
  const [creneaux, setCreneaux] = useState([]);
  const [tarifs, setTarifs] = useState([]); // Pour stocker les catégories
  
  const [selectedCreneau, setSelectedCreneau] = useState(null);
  const [selectedTarif, setSelectedTarif] = useState(null); // La catégorie choisie (objet complet)
  
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    sacrifice_name: "",
  });

  // 1. Charger Utilisateur + Créneaux + Tarifs
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      if (data?.user?.email) {
        setForm((f) => ({ ...f, email: data.user.email }));
      }
    });

    fetchCreneaux();
    fetchTarifs();
  }, []);

  async function fetchCreneaux() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_creneaux_dispo");
    if (error) console.error(error);
    else setCreneaux(data ?? []);
    setLoading(false);
  }

  async function fetchTarifs() {
    const { data, error } = await supabase
      .from("tarifs")
      .select("*")
      .order("prix_cents", { ascending: true });
    
    if (error) console.error("Erreur tarifs:", error);
    else setTarifs(data ?? []);
  }

  // Vérification formulaire complet
  const canSubmit = useMemo(() => {
    return (
      user &&
      selectedCreneau &&
      selectedTarif && // Il faut avoir choisi une catégorie
      Number(selectedCreneau.places_restantes) > 0 &&
      form.first_name &&
      form.last_name &&
      form.phone &&
      form.email &&
      form.sacrifice_name &&
      !paying
    );
  }, [user, selectedCreneau, selectedTarif, form, paying]);

  async function reserverEtPayer() {
    if (!user) return alert("Connecte-toi pour réserver.");

    setPaying(true);
    let commandeId = null;

    try {
      // 1️⃣ Réserver ticket via RPC mise à jour
      const { data, error } = await supabase.rpc("reserve_ticket", {
        p_creneau_id: selectedCreneau.id,
        p_client_id: user.id,
        p_first_name: form.first_name,
        p_last_name: form.last_name,
        p_phone: form.phone,
        p_email: form.email,
        p_address: form.address,
        p_sacrifice_name: form.sacrifice_name,
        p_acompte_cents: ACOMPTE_CENTS,
        p_categorie: selectedTarif.categorie // On envoie "A", "B", ou "C"
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      commandeId = row?.commande_id;
      const ticketNum = row?.ticket_num;

      if (!commandeId) throw new Error("Erreur réservation.");

      // 2️⃣ Redirection Paiement MOCK
      window.location.assign(
        `/mock-pay?commande_id=${encodeURIComponent(commandeId)}&ticket_num=${encodeURIComponent(ticketNum)}`
      );
    } catch (e) {
      console.error(e);
      alert("Erreur : " + e.message);
      fetchCreneaux();
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* En-tête */}
        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-green-700 dark:text-green-400 flex items-center justify-center gap-3">
            <FiUser className="text-2xl sm:text-3xl" />
            Réserver mon Agneau
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Choisissez votre créneau, le type d'agneau et réglez l'acompte.
          </p>
        </div>

        {/* ÉTAPE 1 : CRÉNEAUX */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <FiCalendar className="text-green-600 dark:text-green-400" />
            1. Choisissez un créneau de retrait
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <FiLoader className="animate-spin text-green-600 dark:text-green-400 text-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {creneaux.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCreneau(c)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedCreneau?.id === c.id
                      ? "border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-200 dark:ring-green-800"
                      : "border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-600 bg-white dark:bg-slate-700"
                  }`}
                >
                  <div className="font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100">Jour {c.jour}</div>
                  <div className="text-green-700 dark:text-green-400 font-semibold text-sm sm:text-base flex items-center gap-2 mt-1">
                    <FiClock className="text-xs" />
                    {c.heure_debut} - {c.heure_fin}
                  </div>
                  <div className={`text-xs sm:text-sm mt-2 flex items-center gap-1 ${
                    c.places_restantes > 0 
                      ? "text-green-600 dark:text-green-400" 
                      : "text-red-500 dark:text-red-400"
                  }`}>
                    {c.places_restantes} {c.places_restantes === 1 ? "place" : "places"} dispo
                  </div>
                  {selectedCreneau?.id === c.id && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                      <FiCheck className="text-base" />
                      <span>Sélectionné</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ÉTAPE 2 : CHOIX AGNEAU */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <FiUser className="text-green-600 dark:text-green-400" />
            2. Choisissez votre catégorie
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {tarifs.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 italic col-span-full text-center py-4">
                Aucun tarif configuré.
              </p>
            ) : (
              tarifs.map((t) => (
                <button
                  key={t.categorie}
                  onClick={() => setSelectedTarif(t)}
                  className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all flex flex-col justify-between min-h-[140px] ${
                    selectedTarif?.categorie === t.categorie
                      ? "border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-200 dark:ring-green-800 shadow-md"
                      : "border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-600 hover:shadow-sm bg-white dark:bg-slate-700"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                      Catégorie {t.categorie}
                    </div>
                    <div className="font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100 mb-2">
                      {t.nom}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-green-700 dark:text-green-400">
                      {(t.prix_cents / 100).toFixed(0)} €
                    </span>
                  </div>
                  {selectedTarif?.categorie === t.categorie && (
                    <div className="absolute top-3 right-3 text-green-600 dark:text-green-400">
                      <FiCheck className="text-xl" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ÉTAPE 3 : FORMULAIRE */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <FiUser className="text-green-600 dark:text-green-400" />
            3. Vos coordonnées
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                className="input-field pl-10" 
                placeholder="Prénom" 
                value={form.first_name} 
                onChange={e => setForm({...form, first_name: e.target.value})} 
              />
            </div>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                className="input-field pl-10" 
                placeholder="Nom" 
                value={form.last_name} 
                onChange={e => setForm({...form, last_name: e.target.value})} 
              />
            </div>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                className="input-field pl-10" 
                placeholder="Téléphone" 
                value={form.phone} 
                onChange={e => setForm({...form, phone: e.target.value})} 
              />
            </div>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                className="input-field pl-10" 
                placeholder="Email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
              />
            </div>
            <div className="sm:col-span-2 relative">
              <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                className="input-field w-full pl-10" 
                placeholder="Nom pour le sacrifice (ex: Famille X...)" 
                value={form.sacrifice_name} 
                onChange={e => setForm({...form, sacrifice_name: e.target.value})} 
              />
            </div>
          </div>
        </div>

        {/* RÉCAPITULATIF FINANCIER & BOUTON */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 space-y-3 sm:space-y-4">
          <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
            <span>Prix Total de la bête :</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {selectedTarif ? (selectedTarif.prix_cents / 100) + " €" : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center text-base sm:text-lg font-bold text-green-700 dark:text-green-400 border-t pt-2 border-slate-200 dark:border-slate-700">
            <span>Acompte à régler maintenant :</span>
            <span>{(ACOMPTE_CENTS / 100).toFixed(2)} €</span>
          </div>
          <div className="text-xs text-right text-slate-500 dark:text-slate-400">
            Reste à payer le jour J : {selectedTarif ? ((selectedTarif.prix_cents - ACOMPTE_CENTS) / 100) + " €" : "—"}
          </div>

          <button
            disabled={!canSubmit}
            onClick={reserverEtPayer}
            className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              canSubmit 
                ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 active:opacity-90" 
                : "bg-gray-300 dark:bg-gray-600 cursor-not-allowed text-gray-500 dark:text-gray-400"
            }`}
          >
            {paying ? (
              <>
                <FiLoader className="animate-spin text-xl" />
                <span>Traitement...</span>
              </>
            ) : (
              <>
                <FiCreditCard className="text-xl" />
                <span>Payer l'acompte ({(ACOMPTE_CENTS/100)} €)</span>
              </>
            )}
          </button>
          
          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            Votre réservation est maintenue {RESERVE_TIMEOUT_MIN} min le temps du paiement.
          </p>
        </div>

      </div>

      {/* Style utilitaire pour les inputs */}
      <style>{`
        .input-field {
            border: 2px solid #e2e8f0;
            padding: 12px;
            border-radius: 10px;
            width: 100%;
            outline: none;
            transition: all 0.2s;
            background-color: white;
            color: #1e293b;
        }
        .dark .input-field {
            border-color: #475569;
            background-color: #1e293b;
            color: #f1f5f9;
        }
        .input-field:focus {
            border-color: #22c55e;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
        }
        .dark .input-field:focus {
            border-color: #4ade80;
            box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.2);
        }
        .input-field::placeholder {
            color: #94a3b8;
        }
        .dark .input-field::placeholder {
            color: #64748b;
        }
      `}</style>
    </div>
  );
}