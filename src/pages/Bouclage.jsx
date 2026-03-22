import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  FiSearch, FiCamera, FiX, FiCheckCircle, FiTag, FiUser, FiLoader, FiAlertTriangle, FiDelete
} from "react-icons/fi";
import { logAction } from "../lib/logger";

// 👉 PAVÉ NUMÉRIQUE TACTILE
const PaveNumerique = ({ value, onChange, showFR = false }) => {
  const handleKey = (k) => {
    if (k === 'EFFACER') {
      onChange(value.slice(0, -1));
    } else {
      onChange(value + k);
    }
  };

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showFR ? 'FR ' : '', '0', 'EFFACER']
  ];

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-100 dark:bg-slate-900/80 p-3 sm:p-4 rounded-3xl border-2 border-slate-200 dark:border-slate-700 mt-4 select-none shadow-inner">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {rows.flat().map((k, index) => {
          if (k === '') return <div key={index}></div>;

          const isEffacer = k === 'EFFACER';
          const isFR = k === 'FR ';
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleKey(k)}
              className={`
                flex items-center justify-center h-16 sm:h-20 rounded-2xl font-black text-2xl sm:text-3xl transition-all shadow-sm border-b-4 
                active:scale-95 active:border-b-0 active:translate-y-1
                ${isEffacer ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800 text-xl' : 
                  isFR ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 text-xl' : 
                  'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-orange-50 active:bg-orange-500 active:text-white'}
              `}
            >
              {isEffacer ? <FiDelete className="text-3xl" /> : k}
            </button>
          )
        })}
      </div>
    </div>
  );
};

export default function Bouclage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [joursConfig, setJoursConfig] = useState([]);
  
  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [commande, setCommande] = useState(null);
  
  const [numeroBoucle, setNumeroBoucle] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchJours = async () => {
      const { data } = await supabase.from("jours_fete").select("*");
      setJoursConfig(data || []);
    };
    fetchJours();
  }, []);

  const getJourLabel = (dateStr) => {
    if (!dateStr) return "SANS CRÉNEAU";
    const j = joursConfig.find(jd => jd.date_fete === dateStr);
    return j ? `Jour ${j.numero}` : `Date inconnue`;
  };

  const handleSearch = async (e, overrideVal = null) => {
    if (e) e.preventDefault();
    const val = overrideVal || searchInput;
    if (!val) return;
    
    setLoading(true); 
    setCommande(null); 
    setShowScanner(false);
    
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      
      let query = supabase.from("commandes").select("*, creneaux_horaires(*)");
      
      if (isUUID) {
          query = query.eq("id", val);
      } else {
          query = query.eq("ticket_num", val.toString().trim());
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (!data) {
        showNotification("Dossier introuvable.", "error");
        setSearchInput(""); 
      } else {
        setCommande(data);
        setNumeroBoucle(""); 
        setSearchInput(data.ticket_num?.toString() || "");
      }
    } catch (err) {
      console.error(err);
      showNotification("Erreur de recherche.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (result) => {
    if (result) {
      const rawValue = result[0]?.rawValue || result?.rawValue || result;
      if (rawValue) {
        try {
           const parsed = JSON.parse(rawValue);
           if (parsed.ticket_num) handleSearch(null, parsed.ticket_num);
           else if (parsed.id) handleSearch(null, parsed.id);
           else handleSearch(null, rawValue);
        } catch { handleSearch(null, rawValue); }
      }
    }
  };

  // BOUTON DE GAUCHE : Valide l'agneau mais garde le ticket ouvert pour en ajouter un autre
  const validerEtGarder = async (e) => {
    if (e) e.preventDefault();
    setProcessing(true);
    
    // 👉 VÉRIFICATION DE SÉCURITÉ : Le client a-t-il payé la totalité ?
    const estPaye = commande.statut === 'paye_integralement' || commande.statut === 'validee' || commande.statut === 'bouclee';
    if (!estPaye) {
        showNotification("Action refusée : le client n'a pas payé la totalité de sa commande !", "error");
        setProcessing(false);
        return;
    }

    try {
      let newBoucles = commande.numero_boucle || "";
      if (numeroBoucle.trim()) {
          newBoucles = newBoucles ? `${newBoucles}, ${numeroBoucle.trim()}` : numeroBoucle.trim();
      }

      const { error } = await supabase
        .from("commandes")
        .update({ 
            numero_boucle: newBoucles,
            statut: 'bouclee'
        })
        .eq("id", commande.id);

      if (error) throw error;

      logAction('MODIFICATION', 'BOUCLAGE', { ticket: commande.ticket_num, boucle: numeroBoucle || "Aucune" });
      showNotification(`Agneau validé ! Prêt pour le suivant.`, "success");
      
      setCommande({ ...commande, numero_boucle: newBoucles, statut: 'bouclee' });
      setNumeroBoucle("");
    } catch (err) {
      showNotification("Erreur lors de l'enregistrement.", "error");
    } finally {
      setProcessing(false);
    }
  };

  // BOUTON DE DROITE : Valide l'agneau et ferme le ticket
  const validerBouclage = async (e) => {
    if (e) e.preventDefault();
    setProcessing(true);
    
    // 👉 VÉRIFICATION DE SÉCURITÉ : Le client a-t-il payé la totalité ?
    const estPaye = commande.statut === 'paye_integralement' || commande.statut === 'validee' || commande.statut === 'bouclee';
    if (!estPaye) {
        showNotification("Action refusée : le client n'a pas payé la totalité de sa commande !", "error");
        setProcessing(false);
        return;
    }

    try {
      let newBoucles = commande.numero_boucle || "";
      if (numeroBoucle.trim()) {
          newBoucles = newBoucles ? `${newBoucles}, ${numeroBoucle.trim()}` : numeroBoucle.trim();
      }

      const { error } = await supabase
        .from("commandes")
        .update({ 
            numero_boucle: newBoucles,
            statut: 'bouclee'
        })
        .eq("id", commande.id);

      if (error) throw error;

      logAction('MODIFICATION', 'BOUCLAGE', { ticket: commande.ticket_num, boucle: numeroBoucle || "Aucune" });
      showNotification(`Validé et terminé !`, "success");
      
      setCommande(null);
      setSearchInput("");
      setNumeroBoucle("");
    } catch (err) {
      showNotification("Erreur lors de l'enregistrement.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const renderStatutPaiement = (statut) => {
      if (statut === 'paye_integralement' || statut === 'validee' || statut === 'bouclee') {
          return <p className="font-black text-emerald-600 flex items-center gap-1"><FiCheckCircle/> {statut === 'bouclee' ? "Payé & Bouclé" : "100% Payé"}</p>;
      } else if (statut === 'acompte_paye') {
          return <p className="font-black text-orange-500 flex items-center gap-1"><FiAlertTriangle/> Acompte</p>;
      } else {
          return <p className="font-black text-red-500 flex items-center gap-1"><FiAlertTriangle/> Impayé</p>;
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      
      {/* ÉTAT 1 : RECHERCHE DU TICKET */}
      {!commande && (
          <div className="bg-white dark:bg-slate-800 p-6 md:p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 max-w-lg mx-auto">
              <div className="flex justify-center items-center mb-8">
                  <h2 className="text-2xl font-black flex items-center gap-3 text-slate-800 dark:text-white">
                      <div className="p-2 bg-orange-500 rounded-lg text-white"><FiTag /></div>
                      Identifier le Ticket
                  </h2>
              </div>

              <div className="w-full mb-4">
                  <input 
                      type="text" 
                      value={searchInput} 
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="N° de Ticket..." 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-4xl font-black outline-none border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-center shadow-inner"
                  />
              </div>

              <PaveNumerique value={searchInput} onChange={setSearchInput} showFR={false} />

              <button 
                  onClick={handleSearch}
                  disabled={loading || !searchInput}
                  className="mt-6 w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-black text-xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95"
              >
                  {loading ? <FiLoader className="animate-spin text-2xl"/> : <FiSearch className="text-2xl"/>} 
                  CHERCHER LE DOSSIER
              </button>

              <div className="mt-8 flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t-2 border-slate-100 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center">
                      <span className="px-4 bg-white dark:bg-slate-800 text-sm font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">
                          Ou alors
                      </span>
                  </div>
              </div>

              <button 
                  onClick={() => setShowScanner(true)}
                  className="mt-6 w-full py-5 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95"
              >
                  <FiCamera className="text-3xl" />
                  SCANNER LE QR CODE
              </button>
          </div>
      )}

      {/* ÉTAT 2 : DOSSIER TROUVÉ ET ASSOCIATION */}
      {commande && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
          
          {/* COLONNE GAUCHE */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col h-full">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-6">
                  <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Dossier Client</p>
                      <h3 className="text-3xl font-black text-slate-800 dark:text-white">Ticket #{commande.ticket_num}</h3>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center min-w-[80px]">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase">Catégorie</p>
                      <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{commande.categorie || "?"}</p>
                  </div>
              </div>

              <div className="space-y-4 my-6">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-xl text-slate-500"><FiUser/></div>
                      <div>
                          <p className="font-bold text-slate-800 dark:text-white text-lg">{commande.contact_last_name} {commande.contact_first_name}</p>
                          <p className="text-sm text-slate-500 flex items-center gap-2">Sacrifice : <span className="font-bold text-slate-700 dark:text-slate-300">{commande.sacrifice_name}</span></p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                          <p className="text-xs font-bold text-orange-600/70 uppercase mb-1">Jour Prévu</p>
                          <p className="font-black text-orange-700 dark:text-orange-500 text-lg">
                              {getJourLabel(commande.creneaux_horaires?.date)}
                              {commande.creneaux_horaires?.heure_debut && (
                                  <span className="text-sm ml-1 opacity-80 font-bold">
                                      à {commande.creneaux_horaires.heure_debut.slice(0, 5)}
                                  </span>
                              )}
                          </p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Statut Paiement</p>
                          {renderStatutPaiement(commande.statut)}
                      </div>
                  </div>
              </div>

              {/* BOUTONS EN BAS À GAUCHE */}
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <button 
                      onClick={validerEtGarder}
                      disabled={processing}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
                  >
                      <FiCheckCircle className="text-xl" />
                      Boucler l'agneau (Ajouter un autre)
                  </button>
                  <button 
                      onClick={() => { setCommande(null); setSearchInput(""); setNumeroBoucle(""); }} 
                      className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                      <FiX /> Fermer le ticket sans valider
                  </button>
              </div>
          </div>

          {/* COLONNE DROITE */}
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border-t-8 border-orange-500 flex flex-col items-center">
              <h3 className="text-2xl font-black mb-4 text-slate-800 dark:text-white w-full text-left">Validation Rapide</h3>
              
              <div className="w-full text-center text-slate-500 mb-6">
                 Vous pouvez valider ce dossier directement. <br/>
                 (Le numéro de boucle est désormais facultatif).
              </div>

              {commande.numero_boucle && (
                  <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl mb-4 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs font-bold uppercase mb-1 flex items-center gap-2"><FiTag/> Déjà associé(s) :</p>
                      <p className="text-xl font-black">{commande.numero_boucle}</p>
                  </div>
              )}

              <div className="w-full mb-2">
                  <input 
                      type="text" 
                      value={numeroBoucle} 
                      onChange={(e) => setNumeroBoucle(e.target.value.toUpperCase())}
                      placeholder="N° Boucle (Facultatif)" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-4xl font-black outline-none border-2 border-slate-200 dark:border-slate-700 text-orange-600 dark:text-orange-400 text-center uppercase shadow-inner"
                  />
              </div>

              <PaveNumerique value={numeroBoucle} onChange={setNumeroBoucle} showFR={true} />

              <button 
                  onClick={validerBouclage}
                  disabled={processing}
                  className="mt-6 w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-black text-xl shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95"
              >
                  {processing ? <FiLoader className="animate-spin text-2xl"/> : <FiCheckCircle className="text-2xl"/>} 
                  VALIDER ET TERMINER
              </button>
          </div>
        </div>
      )}

      {/* MODALE SCANNER CAMERA */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <button onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors">
                <FiX className="text-3xl" />
            </button>
            <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden border-4 border-orange-500 shadow-2xl relative aspect-square">
                <Scanner onScan={handleScan} />
            </div>
            <p className="text-white mt-6 font-bold tracking-wider text-center">Visez le QR Code du ticket client</p>
        </div>
      )}

    </div>
  );
}