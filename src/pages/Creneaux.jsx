import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { 
  FiCalendar, FiClock, FiTrash2, FiPlus, FiAlertCircle, FiSettings 
} from "react-icons/fi";

export default function Creneaux() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [creneaux, setCreneaux] = useState([]);
  const [jours, setJours] = useState([]);

  // Formulaire d'ajout
  const [newSlot, setNewSlot] = useState({
    date: "",
    heure_debut: "",
    heure_fin: "",
    capacite_max: 50 // Valeur par défaut indicative
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // 1. Charger la configuration des jours (Jour 1, Jour 2...)
      const { data: days } = await supabase.from("jours_fete").select("*").order("date_fete");
      setJours(days || []);

      // 2. Charger les créneaux existants
      const { data: slots, error } = await supabase
        .from("creneaux_horaires")
        .select("*")
        .order("date", { ascending: true })
        .order("heure_debut", { ascending: true });

      if (error) throw error;
      setCreneaux(slots || []);
    } catch (err) {
      console.error(err);
      showNotification("Erreur chargement.", "error");
    } finally {
      setLoading(false);
    }
  }

  // --- AJOUTER UN CRÉNEAU ---
  async function handleAdd(e) {
    e.preventDefault();
    if (!newSlot.date || !newSlot.heure_debut || !newSlot.heure_fin) return;

    try {
      const { error } = await supabase.from("creneaux_horaires").insert([{
        date: newSlot.date,
        heure_debut: newSlot.heure_debut,
        heure_fin: newSlot.heure_fin,
        capacite_max: newSlot.capacite_max,
        places_disponibles: 0 // Le stock commence à 0, il faudra ajouter des tickets dans la page Stock
      }]);

      if (error) throw error;
      
      showNotification("Créneau ajouté avec succès !", "success");
      // On garde la date pour enchainer les saisies, on reset juste l'heure
      setNewSlot(prev => ({ ...prev, heure_debut: "", heure_fin: "" })); 
      loadData();
    } catch (err) {
      showNotification("Erreur ajout : " + err.message, "error");
    }
  }

  // --- SUPPRESSION SÉCURISÉE (CORRIGÉE) ---
  async function handleDelete(id) {
    if (!window.confirm("Supprimer ce créneau ? Les tickets associés seront détachés et remis en stock 'Interne'.")) return;

    try {
      // C'est ICI la correction : on utilise la fonction RPC pour éviter l'erreur 409
      const { error } = await supabase.rpc("supprimer_creneau_safe", { 
        p_creneau_id: id 
      });

      if (error) throw error;

      showNotification("Créneau supprimé proprement.", "info");
      loadData();
    } catch (err) {
      console.error(err);
      showNotification("Impossible de supprimer : " + err.message, "error");
    }
  }

  // Helper pour l'affichage (ex: "2025-06-16" -> "JOUR 1")
  const getJourLabel = (dateStr) => {
    const j = jours.find(jd => jd.date_fete === dateStr);
    return j ? `JOUR ${j.numero} (${new Date(dateStr).toLocaleDateString()})` : dateStr;
  };

  // Groupement des créneaux par Jour pour l'affichage
  const groupedSlots = creneaux.reduce((acc, curr) => {
    const label = getJourLabel(curr.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(curr);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                <FiSettings className="text-2xl" />
            </div>
            Configuration Créneaux
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Définissez les plages horaires d'ouverture de l'abattoir.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLONNE GAUCHE : FORMULAIRE D'AJOUT */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 sticky top-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
              <FiPlus className="text-indigo-500" /> Nouveau Créneau
            </h3>
            
            <form onSubmit={handleAdd} className="space-y-5">
              
              {/* Choix du Jour */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Jour</label>
                <div className="relative">
                    <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                    value={newSlot.date}
                    onChange={e => setNewSlot({...newSlot, date: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white appearance-none font-medium"
                    required
                    >
                    <option value="">-- Sélectionner --</option>
                    {jours.map(j => (
                        <option key={j.id} value={j.date_fete}>
                        Jour {j.numero} ({new Date(j.date_fete).toLocaleDateString()})
                        </option>
                    ))}
                    </select>
                </div>
              </div>

              {/* Heures */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Début</label>
                  <input 
                    type="time" 
                    value={newSlot.heure_debut}
                    onChange={e => setNewSlot({...newSlot, heure_debut: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fin</label>
                  <input 
                    type="time" 
                    value={newSlot.heure_fin}
                    onChange={e => setNewSlot({...newSlot, heure_fin: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              {/* Capacité (Info) */}
              <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Capacité Max (Info)</label>
                 <input 
                    type="number"
                    value={newSlot.capacite_max}
                    onChange={e => setNewSlot({...newSlot, capacite_max: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:text-white font-bold"
                 />
              </div>

              <button 
                type="submit" 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 transform active:scale-95"
              >
                <FiPlus className="text-xl" /> Ajouter le créneau
              </button>
            </form>

            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 rounded-xl text-xs flex gap-3 items-start border border-amber-100 dark:border-amber-800">
               <FiAlertCircle className="text-xl shrink-0 mt-0.5" />
               <p>
                 <strong>Attention :</strong> Créer un créneau n'ajoute pas de places automatiquement. 
                 <br/><br/>
                 Vous devrez aller dans l'onglet <strong>Stock</strong> pour y ajouter des tickets numérotés.
               </p>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : LISTE DES CRÉNEAUX */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? <div className="text-center py-12 text-slate-400">Chargement des données...</div> : 
           Object.keys(groupedSlots).length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
               <FiCalendar className="text-4xl text-slate-300 mb-4" />
               <p className="text-slate-500 font-medium">Aucun créneau configuré pour le moment.</p>
             </div>
           ) : (
             Object.entries(groupedSlots).map(([jourLabel, slots]) => (
               <div key={jourLabel} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
                 
                 {/* En-tête Jour */}
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                   <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg"><FiCalendar className="text-lg" /></div>
                   <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wide">{jourLabel}</h3>
                 </div>
                 
                 {/* Liste des heures */}
                 <div className="divide-y divide-slate-100 dark:divide-slate-700">
                   {slots.map(s => (
                     <div key={s.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                       <div className="flex items-center gap-5">
                         
                         {/* Heure */}
                         <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-center min-w-[90px] border border-slate-200 dark:border-slate-600">
                           <div className="font-bold text-lg text-slate-800 dark:text-white leading-none mb-1">{s.heure_debut.slice(0,5)}</div>
                           <div className="text-xs text-slate-500 font-medium">{s.heure_fin.slice(0,5)}</div>
                         </div>

                         {/* Infos Stock */}
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Capacité : {s.capacite_max}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
                                    {s.places_disponibles} en stock
                                </span>
                            </div>
                         </div>
                       </div>

                       {/* Bouton Supprimer */}
                       <button 
                         onClick={() => handleDelete(s.id)}
                         className="p-3 text-slate-400 hover:text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                         title="Supprimer ce créneau et libérer les tickets"
                       >
                         <FiTrash2 className="text-xl" />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
             ))
           )
          }
        </div>

      </div>
    </div>
  );
}