import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";
import { FiUser, FiDollarSign, FiUpload, FiBarChart2 } from "react-icons/fi";

export default function AdminAgneaux() {
  const { showAlert, showConfirm, showNotification } = useNotification();
  const [tarifs, setTarifs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Import
  const [importText, setImportText] = useState("");
  const [importLog, setImportLog] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    // 1. Récupérer les tarifs
    const { data: dataTarifs } = await supabase.from("tarifs").select("*").order("prix_cents");
    setTarifs(dataTarifs || []);

    // 2. Récupérer les stats de stock (bêtes importées)
    const { data: dataAgneaux } = await supabase.from("agneaux").select("categorie, statut");
    
    // Calcul simple des stats
    const statsObj = {};
    (dataAgneaux || []).forEach(a => {
        const key = `${a.categorie} - ${a.statut}`;
        statsObj[key] = (statsObj[key] || 0) + 1;
    });
    setStats(statsObj);

    setLoading(false);
  }

  // --- MISE À JOUR PRIX ---
  async function updatePrix(categorie, newPrix) {
    const { error } = await supabase
      .from("tarifs")
      .update({ prix_cents: newPrix * 100 }) // on stocke en centimes
      .eq("categorie", categorie);
    
    if (error) showNotification("Erreur: " + error.message, "error");
    else fetchData();
  }

  // --- IMPORT CSV ---
  async function handleImport() {
    if (!importText) return;
    setImportLog("Analyse en cours...");
    
    // Format attendu: NUMERO_BOUCLE, CATEGORIE (une par ligne)
    const lines = importText.split("\n");
    let successCount = 0;
    let errorCount = 0;

    for (let line of lines) {
        const [num, cat] = line.split(",").map(s => s?.trim());
        if (!num || !cat) continue; // Ligne vide ou malformée

        const { error } = await supabase.from("agneaux").insert({
            numero_boucle: num,
            categorie: cat.toUpperCase(),
            statut: 'disponible'
        });

        if (error) {
            console.error("Erreur ligne " + line, error);
            errorCount++;
        } else {
            successCount++;
        }
    }

    setImportLog(`Terminé ! ✅ ${successCount} ajoutés, ❌ ${errorCount} erreurs (doublons?).`);
    setImportText("");
    fetchData();
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <FiUser className="text-3xl text-indigo-600 dark:text-indigo-400" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Gestion du Cheptel & Tarifs</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Configuration des prix et import du stock</p>
        </div>
      </div>

      {/* 1. GESTION DES TARIFS */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FiDollarSign className="text-indigo-600 dark:text-indigo-400" />
          Configuration des Prix
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tarifs.map(t => (
            <div key={t.categorie} className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-5 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="font-black text-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg">Catégorie {t.categorie}</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    className="border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-2 w-20 text-right font-bold rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
                    defaultValue={t.prix_cents / 100}
                    onBlur={(e) => updatePrix(t.categorie, e.target.value)}
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-bold">€</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{t.nom}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. IMPORT STOCK */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FiUpload className="text-indigo-600 dark:text-indigo-400" />
          Importer des Agneaux (Stock Réel)
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Copiez-collez votre liste Excel ici. Format par ligne : <code className="bg-gray-100 dark:bg-slate-700 p-1">NUMERO_DE_BOUCLE, CATEGORIE</code><br/>
            Exemple : <br/>
            FR123456, A<br/>
            FR987654, B
        </p>
        
        <textarea 
          className="w-full border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100 p-4 rounded-xl font-mono text-sm h-32 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
          placeholder="FR001, A&#10;FR002, A&#10;FR003, B"
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        
        <div className="flex justify-between items-center mt-4">
          <button 
            onClick={handleImport}
            disabled={!importText}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FiUpload className="text-lg" />
            <span>Lancer l'import</span>
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{importLog}</span>
        </div>
      </div>

      {/* 3. STATISTIQUES STOCK */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FiBarChart2 className="text-indigo-600 dark:text-indigo-400" />
          État du Stock
        </h2>
        {Object.keys(stats).length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <FiBarChart2 className="text-4xl mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun agneau en stock pour l'instant.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats).map(([key, count]) => (
              <div key={key} className="bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 px-4 py-3 rounded-xl">
                <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold uppercase mr-2">{key} :</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-400 text-lg">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}