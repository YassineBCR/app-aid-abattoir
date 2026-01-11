import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminAgneaux() {
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
    
    if (error) alert("Erreur: " + error.message);
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
      <h1 className="text-2xl font-bold text-gray-800">Gestion du Cheptel & Tarifs</h1>

      {/* 1. GESTION DES TARIFS */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-bold text-lg mb-4 text-indigo-700">1. Configuration des Prix</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tarifs.map(t => (
                <div key={t.categorie} className="border p-4 rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-black text-xl bg-indigo-100 px-2 py-1 rounded">Catégorie {t.categorie}</span>
                        <input 
                            type="number" 
                            className="border p-1 w-24 text-right font-bold rounded"
                            defaultValue={t.prix_cents / 100}
                            onBlur={(e) => updatePrix(t.categorie, e.target.value)}
                        />
                        <span className="ml-1">€</span>
                    </div>
                    <p className="text-sm font-semibold">{t.nom}</p>
                    <p className="text-xs text-gray-500">{t.description}</p>
                </div>
            ))}
        </div>
      </div>

      {/* 2. IMPORT STOCK */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-bold text-lg mb-2 text-green-700">2. Importer des Agneaux (Stock Réel)</h2>
        <p className="text-sm text-gray-500 mb-4">
            Copiez-collez votre liste Excel ici. Format par ligne : <code className="bg-gray-100 p-1">NUMERO_DE_BOUCLE, CATEGORIE</code><br/>
            Exemple : <br/>
            FR123456, A<br/>
            FR987654, B
        </p>
        
        <textarea 
            className="w-full border p-3 rounded-lg font-mono text-sm h-32"
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
            <span className="text-sm font-semibold text-gray-700">{importLog}</span>
        </div>
      </div>

      {/* 3. STATISTIQUES STOCK */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-bold text-lg mb-4">3. État du Stock</h2>
        {Object.keys(stats).length === 0 ? (
            <p className="text-gray-400 italic">Aucun agneau en stock pour l'instant.</p>
        ) : (
            <div className="flex flex-wrap gap-3">
                {Object.entries(stats).map(([key, count]) => (
                    <div key={key} className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
                        <span className="text-gray-600 text-sm uppercase mr-2">{key} :</span>
                        <span className="font-bold text-blue-800 text-lg">{count}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}