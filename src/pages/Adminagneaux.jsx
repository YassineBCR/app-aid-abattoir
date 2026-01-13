import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "../contexts/NotificationContext";

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
    <div className="space-y-8 animate-fade-in p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Gestion du Cheptel & Tarifs</h1>

      {/* 1. GESTION DES TARIFS */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
        <h2 className="font-bold text-lg mb-4 text-green-700 dark:text-green-400">1. Configuration des Prix</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tarifs.map(t => (
                <div key={t.categorie} className="border dark:border-slate-700 p-4 rounded-lg bg-gray-50 dark:bg-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-black text-xl bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-1 rounded">Catégorie {t.categorie}</span>
                        <input 
                            type="number" 
                            className="border dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100 p-1 w-24 text-right font-bold rounded"
                            defaultValue={t.prix_cents / 100}
                            onBlur={(e) => updatePrix(t.categorie, e.target.value)}
                        />
                        <span className="ml-1 text-slate-800 dark:text-slate-200">€</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.nom}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.description}</p>
                </div>
            ))}
        </div>
      </div>

      {/* 2. IMPORT STOCK */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
        <h2 className="font-bold text-lg mb-2 text-green-700 dark:text-green-400">2. Importer des Agneaux (Stock Réel)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Copiez-collez votre liste Excel ici. Format par ligne : <code className="bg-gray-100 dark:bg-slate-700 p-1">NUMERO_DE_BOUCLE, CATEGORIE</code><br/>
            Exemple : <br/>
            FR123456, A<br/>
            FR987654, B
        </p>
        
        <textarea 
            className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 p-3 rounded-lg font-mono text-sm h-32"
            placeholder="FR001, A&#10;FR002, A&#10;FR003, B"
            value={importText}
            onChange={e => setImportText(e.target.value)}
        />
        
        <div className="flex justify-between items-center mt-4">
            <button 
                onClick={handleImport}
                disabled={!importText}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
                📥 Lancer l'import
            </button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{importLog}</span>
        </div>
      </div>

      {/* 3. STATISTIQUES STOCK */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
        <h2 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100">3. État du Stock</h2>
        {Object.keys(stats).length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 italic">Aucun agneau en stock pour l'instant.</p>
        ) : (
            <div className="flex flex-wrap gap-3">
                {Object.entries(stats).map(([key, count]) => (
                    <div key={key} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-2 rounded-lg">
                        <span className="text-gray-600 dark:text-gray-400 text-sm uppercase mr-2">{key} :</span>
                        <span className="font-bold text-green-800 dark:text-green-400 text-lg">{count}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}