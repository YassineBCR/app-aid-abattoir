import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiCalendar, FiTrash2, FiPlus, FiSave, FiList, FiAlertCircle } from "react-icons/fi";

export default function AdminSite() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  
  // Données
  const [joursConfig, setJoursConfig] = useState([]);
  const [creneaux, setCreneaux] = useState([]);

  // Formulaires
  const [newJourNum, setNewJourNum] = useState("");
  const [newJourDate, setNewJourDate] = useState("");
  
  const [selectedJour, setSelectedJour] = useState("");
  const [heureDebut, setHeureDebut] = useState("08:00");
  const [heureFin, setHeureFin] = useState("09:00");
  const [quota, setQuota] = useState(50); // Capacité théorique

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Charger les Jours
      const { data: jours, error: errJours } = await supabase
        .from("jours_fete")
        .select("*")
        .order("numero", { ascending: true });
      
      if (errJours) throw errJours;
      setJoursConfig(jours || []);

      // 2. Charger les Créneaux
      const { data: slots, error: errSlots } = await supabase
        .from("creneaux_horaires")
        .select("*")
        .order("date", { ascending: true })
        .order("heure_debut", { ascending: true });

      if (errSlots) throw errSlots;
      setCreneaux(slots || []);

    } catch (error) {
      console.error(error);
      showNotification("Erreur chargement données", "error");
    } finally {
      setLoading(false);
    }
  }

  // --- LOGIQUE JOURS ---
  async function handleAddJour(e) {
    e.preventDefault();
    if (!newJourNum || !newJourDate) return;

    try {
      const { error } = await supabase
        .from("jours_fete")
        .upsert({ numero: parseInt(newJourNum), date_fete: newJourDate })
        .select();

      if (error) throw error;
      showNotification(`Jour ${newJourNum} configuré !`, "success");
      setNewJourNum("");
      setNewJourDate("");
      loadData();
    } catch (error) {
      showNotification("Erreur configuration jour : " + error.message, "error");
    }
  }

  // --- LOGIQUE CRÉNEAUX (CORRIGÉE) ---
  async function handleAddCreneau(e) {
    e.preventDefault();
    if (!selectedJour) return showNotification("Veuillez choisir un Jour (1, 2...)", "error");

    const jourConf = joursConfig.find(j => j.numero === parseInt(selectedJour));
    if (!jourConf) return showNotification("Ce jour n'est pas configuré.", "error");

    try {
      const { error } = await supabase.from("creneaux_horaires").insert({
        date: jourConf.date_fete,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        capacite_max: parseInt(quota), 
        places_disponibles: 0, // IMPORTANT : On commence à 0. Les tickets s'ajoutent dans l'onglet "Stock".
      });

      if (error) throw error;
      showNotification("Créneau ajouté ! Allez dans 'Stock' pour ajouter les tickets.", "success");
      loadData();
    } catch (error) {
      console.error(error);
      showNotification("Erreur ajout créneau : " + error.message, "error");
    }
  }

  // --- SUPPRESSION SÉCURISÉE (CORRIGÉE) ---
  async function deleteCreneau(id) {
    if (!window.confirm("Supprimer ce créneau ? Les tickets associés seront détachés.")) return;
    
    try {
      // ✅ UTILISATION DE LA RPC POUR ÉVITER L'ERREUR 409
      const { error } = await supabase.rpc("supprimer_creneau_safe", { 
        p_creneau_id: id 
      });

      if (error) throw error;

      showNotification("Créneau supprimé proprement.", "info");
      loadData();
    } catch (error) {
      console.error(error);
      showNotification("Erreur suppression : " + error.message, "error");
    }
  }

  const getJourLabel = (dateString) => {
    const jour = joursConfig.find(j => j.date_fete === dateString);
    return jour ? `JOUR ${jour.numero}` : dateString;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
        <FiCalendar className="text-indigo-600" />
        Configuration Globale
      </h1>

      {/* --- 1. CONFIGURATION DES JOURS --- */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-4 border-indigo-500">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          1. Configurer les Jours de Fête
        </h2>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Numéro (ex: 1)</label>
            <input
              type="number"
              value={newJourNum}
              onChange={(e) => setNewJourNum(e.target.value)}
              placeholder="1"
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date réelle</label>
            <input
              type="date"
              value={newJourDate}
              onChange={(e) => setNewJourDate(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>
          <button onClick={handleAddJour} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
            <FiSave /> Sauvegarder
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {joursConfig.map(j => (
            <div key={j.numero} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg text-sm border border-indigo-100 dark:border-indigo-800">
              <strong>JOUR {j.numero}</strong> : {new Date(j.date_fete).toLocaleDateString('fr-FR')}
            </div>
          ))}
        </div>
      </div>

      {/* --- 2. AJOUTER DES CRÉNEAUX --- */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-4 border-emerald-500">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          2. Ajouter des Créneaux
        </h2>
        <form onSubmit={handleAddCreneau} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jour ?</label>
            <select
              value={selectedJour}
              onChange={(e) => setSelectedJour(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-bold"
            >
              <option value="">-- Choisir --</option>
              {joursConfig.map(j => (
                <option key={j.numero} value={j.numero}>JOUR {j.numero}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Début</label>
            <input
              type="time"
              value={heureDebut}
              onChange={(e) => setHeureDebut(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fin</label>
            <input
              type="time"
              value={heureFin}
              onChange={(e) => setHeureFin(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacité Max</label>
            <input
              type="number"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
            />
          </div>
          <div className="md:col-span-1">
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
              <FiPlus /> Créer
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 rounded-lg text-sm flex gap-2 items-start">
             <FiAlertCircle className="mt-1 shrink-0" />
             <p>N'oubliez pas d'aller dans l'onglet <strong>Stock</strong> après la création pour ajouter les tickets réels (ex: 100 à 150).</p>
        </div>
      </div>

      {/* --- TABLEAU --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FiList /> Liste des Créneaux Actifs
            </h3>
            <span className="text-sm text-slate-500 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">{creneaux.length} créneaux</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                <th className="p-4">Jour</th>
                <th className="p-4">Horaire</th>
                <th className="p-4">Capacité (Info)</th>
                <th className="p-4">Stock Réel</th>
                <th className="p-4 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {creneaux.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                    <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg font-bold text-sm">
                        {getJourLabel(c.date)}
                    </span>
                    </td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                    {c.heure_debut.slice(0, 5)} - {c.heure_fin.slice(0, 5)}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                    {c.capacite_max} places
                    </td>
                    <td className="p-4">
                        <span className={`font-bold ${c.places_disponibles > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {c.places_disponibles} dispo
                        </span>
                    </td>
                    <td className="p-4 text-right">
                    <button
                        onClick={() => deleteCreneau(c.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all"
                        title="Supprimer (Libère les tickets)"
                    >
                        <FiTrash2 className="text-lg" />
                    </button>
                    </td>
                </tr>
                ))}
                {creneaux.length === 0 && (
                    <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400 italic">Aucun créneau configuré.</td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}