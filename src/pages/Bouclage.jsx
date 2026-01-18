import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { Scanner } from "@yudiel/react-qr-scanner";
import { 
  FiTag, FiCamera, FiX, FiCheckCircle, FiAlertTriangle, FiLock, FiDelete, FiSearch, FiUser, FiClock, FiXOctagon
} from "react-icons/fi";

export default function Bouclage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  
  // États
  const [searchInput, setSearchInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState(null);
  
  // --- GESTION DU PAVÉ NUMÉRIQUE ---
  const handleNumClick = (num) => {
    if (searchInput.length < 6) setSearchInput(prev => prev + num);
  };
  const handleClear = () => setSearchInput("");
  const handleBackspace = () => setSearchInput(prev => prev.slice(0, -1));

  // --- 1. RECHERCHE SÉCURISÉE AVEC VÉRIFICATIONS ---
  const handleSearch = async (e = null, overrideVal = null) => {
    if (e) e.preventDefault();
    const val = overrideVal || searchInput;
    if (!val) return showNotification("Veuillez entrer un numéro", "warning");

    setLoading(true);
    
    try {
      // On récupère la commande ET le créneau lié
      const { data, error } = await supabase
        .from("commandes")
        .select("*, creneaux_horaires(*)")
        .or(`ticket_num.eq.${parseInt(val) || 0},id.eq.${val}`)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        showNotification("❌ Ticket inconnu / introuvable.", "error");
        setSelectedCommande(null);
      } else {
        // --- SÉCURITÉ 1 : STATUT ---
        if (data.statut === 'annule') {
            showNotification("⛔ Ce ticket est ANNULÉ.", "error");
            setSelectedCommande(null);
            setSearchInput("");
            return;
        }

        // --- SÉCURITÉ 2 : CRÉNEAU OBLIGATOIRE ---
        if (!data.creneaux_horaires) {
            showNotification("⚠️ Erreur : Ce ticket n'a pas de créneau attribué.", "warning");
        }

        // Tout est récupéré, on affiche le modal de contrôle
        setSelectedCommande(data);
        setShowScanner(false);
        setSearchInput("");
      }
    } catch (err) {
      console.error(err);
      showNotification("Erreur technique recherche.", "error");
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
        } catch {
           handleSearch(null, rawValue);
        }
      }
    }
  };

  // --- 2. VALIDATION DU BOUCLAGE ---
  const handleValidateBouclage = async () => {
    if (!selectedCommande) return;
    
    // RE-VÉRIFICATION STRICTE AVANT ENVOI
    const paid = selectedCommande.montant_paye_cents || 0;
    const total = selectedCommande.montant_total_cents || 0;
    
    if (paid < total) {
        return showNotification("⛔ INTERDIT : Commande non soldée !", "error");
    }

    if (!selectedCommande.creneaux_horaires) {
        return showNotification("⛔ INTERDIT : Aucun créneau associé !", "error");
    }

    if (selectedCommande.date_bouclage || selectedCommande.statut === 'bouclee') {
        return showNotification("⚠️ Déjà bouclé !", "warning");
    }

    setLoading(true);
    try {
        const numeroBoucleAuto = selectedCommande.ticket_num.toString();

        const { error } = await supabase
            .from("commandes")
            .update({
                numero_boucle: numeroBoucleAuto,
                date_bouclage: new Date().toISOString(),
                statut: 'bouclee'
            })
            .eq("id", selectedCommande.id);

        if (error) throw error;

        showNotification(`✅ Validé ! Boucle N° ${numeroBoucleAuto} posée.`, "success");
        setSelectedCommande(null);
    } catch (err) {
        console.error(err);
        showNotification("Erreur technique lors du bouclage.", "error");
    } finally {
        setLoading(false);
    }
  };

  // --- HELPERS D'AFFICHAGE ---
  const paid = selectedCommande?.montant_paye_cents || 0;
  const total = selectedCommande?.montant_total_cents || 0;
  
  // Est-ce valide ?
  const isPaid = paid >= total && total > 0;
  const hasCreneau = !!selectedCommande?.creneaux_horaires;
  const isDejaBoucle = selectedCommande?.date_bouclage || selectedCommande?.statut === 'bouclee';
  
  // Calcul reste
  const reste = (total - paid) / 100;

  const formatBouclageDate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return `le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`;
  };

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto min-h-screen pb-20 animate-fade-in flex flex-col items-center">
      
      {/* HEADER */}
      <div className="mb-6 text-center w-full">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <FiTag className="text-orange-500" /> Espace Bouclage
        </h1>
        <p className="text-slate-500 text-sm font-medium">Contrôle & Attribution</p>
      </div>

      {/* --- PAVÉ NUMÉRIQUE --- */}
      <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
          
          <div className="mb-6 bg-slate-100 dark:bg-slate-900 rounded-2xl h-20 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 overflow-hidden relative">
              <span className={`text-4xl font-mono font-bold tracking-widest ${searchInput ? 'text-slate-800 dark:text-white' : 'text-slate-300'}`}>
                  {searchInput || "---"}
              </span>
              {searchInput && (
                  <button onClick={handleBackspace} className="absolute right-4 text-slate-400 hover:text-red-500 p-2">
                      <FiDelete className="text-2xl" />
                  </button>
              )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button key={num} onClick={() => handleNumClick(num.toString())} className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-2xl font-bold text-slate-700 dark:text-white shadow-sm active:scale-95 transition-all">{num}</button>
              ))}
              <button onClick={handleClear} className="h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 font-bold text-lg active:scale-95 transition-all">C</button>
              <button onClick={() => handleNumClick("0")} className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-2xl font-bold text-slate-700 dark:text-white shadow-sm active:scale-95 transition-all">0</button>
              <button onClick={handleBackspace} className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-500 hover:text-slate-700 active:scale-95 transition-all flex items-center justify-center"><FiDelete className="text-2xl" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowScanner(true)} className="h-16 rounded-2xl bg-slate-800 hover:bg-black text-white font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><FiCamera className="text-xl"/> SCAN</button>
              <button onClick={() => handleSearch()} className="h-16 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 active:scale-95 transition-all"><FiSearch className="text-xl"/> OK</button>
          </div>
      </div>

      {/* --- SCANNER --- */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md aspect-square relative bg-black rounded-3xl overflow-hidden shadow-2xl">
                <Scanner onScan={handleScan} />
                <div className="absolute inset-0 border-4 border-orange-500/50 rounded-lg pointer-events-none"></div>
            </div>
            <button onClick={() => setShowScanner(false)} className="mt-8 px-8 py-4 bg-white text-black font-bold rounded-full flex items-center gap-2 shadow-xl active:scale-95 transition-transform"><FiX /> Fermer</button>
        </div>
      )}

      {/* --- MODAL DE RÉSULTAT ET CONTRÔLE --- */}
      {selectedCommande && (
          <div className="fixed inset-0 z-40 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* EN-TÊTE MODAL */}
                  <div className={`p-6 text-white flex justify-between items-start ${
                      isDejaBoucle ? 'bg-slate-600' : (isPaid && hasCreneau ? 'bg-emerald-600' : 'bg-red-600')
                  }`}>
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono bg-white/20 px-2 py-1 rounded text-sm font-bold">#{selectedCommande.ticket_num}</span>
                              <span className="font-bold uppercase tracking-wider text-sm flex items-center gap-1">
                                  {isDejaBoucle ? <><FiLock/> FAIT</> : (isPaid ? <><FiCheckCircle/> OK</> : <><FiXOctagon/> IMPAYÉ</>)}
                              </span>
                          </div>
                          <h2 className="text-xl font-bold opacity-90 uppercase">Vérification Requise</h2>
                      </div>
                      <button onClick={() => setSelectedCommande(null)} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"><FiX className="text-xl"/></button>
                  </div>

                  <div className="p-6 space-y-6 overflow-y-auto">
                      
                      {/* 1. VÉRIFICATION CLIENT (Identité) */}
                      <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-4">
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm text-slate-400"><FiUser className="text-2xl"/></div>
                          <div>
                              <p className="text-xs font-bold text-slate-400 uppercase">Client</p>
                              <p className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                                  {selectedCommande.contact_last_name} {selectedCommande.contact_first_name}
                              </p>
                              <p className="text-sm text-slate-500">{selectedCommande.contact_phone}</p>
                          </div>
                      </div>

                      {/* 2. VÉRIFICATION CRÉNEAU */}
                      {hasCreneau ? (
                          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-4">
                              <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm text-indigo-500"><FiClock className="text-2xl"/></div>
                              <div>
                                  <p className="text-xs font-bold text-slate-400 uppercase">Créneau Réservé</p>
                                  <p className="text-lg font-black text-slate-800 dark:text-white">
                                      {selectedCommande.creneaux_horaires.heure_debut.slice(0,5)} - {selectedCommande.creneaux_horaires.heure_fin.slice(0,5)}
                                  </p>
                                  <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block mt-1">Vérifiez l'heure !</p>
                              </div>
                          </div>
                      ) : (
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-center gap-3">
                              <FiAlertTriangle className="text-red-500 text-2xl"/>
                              <p className="font-bold text-red-600">AUCUN CRÉNEAU DÉFINI !</p>
                          </div>
                      )}

                      <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

                      {/* 3. ÉTAT DU DOSSIER */}
                      
                      {/* CAS A : DÉJÀ FAIT */}
                      {isDejaBoucle && (
                          <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl text-center">
                              <p className="font-black text-slate-600 dark:text-slate-400">DÉJÀ BOUCLÉ</p>
                              <p className="text-xs text-slate-500">{formatBouclageDate(selectedCommande.date_bouclage)}</p>
                          </div>
                      )}

                      {/* CAS B : IMPAYÉ */}
                      {!isPaid && !isDejaBoucle && (
                          <div className="text-center animate-pulse">
                              <p className="font-black text-red-600 text-xl uppercase">Règlement Incomplet</p>
                              <p className="text-slate-500">Reste à payer : <span className="font-bold text-red-600">{reste.toFixed(2)} €</span></p>
                              <div className="mt-4 p-3 bg-red-100 text-red-800 font-bold rounded-xl flex items-center justify-center gap-2">
                                  <FiXOctagon /> Bouclage Interdit
                              </div>
                          </div>
                      )}

                      {/* CAS C : PRÊT */}
                      {!isDejaBoucle && isPaid && hasCreneau && (
                          <div className="text-center">
                              <p className="text-slate-400 text-xs font-bold uppercase mb-2">Action Requise</p>
                              <button 
                                  onClick={handleValidateBouclage}
                                  disabled={loading}
                                  className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/30 text-xl flex justify-center items-center gap-3 active:scale-[0.98] transition-all transform hover:-translate-y-1"
                              >
                                  {loading ? "..." : <><FiCheckCircle className="text-2xl"/> POSER BOUCLE N°{selectedCommande.ticket_num}</>}
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}